// Velora Rust 侧职责边界(ADR-003):只做 FS / Git / Export 等系统能力,不含文档业务规则。

use serde::Serialize;
use std::path::Path;

// ── 日志(写 app data 目录,前端错误双写) ────────────────────

fn log_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_log_dir()
        .map_err(|e| format!("获取日志目录失败: {e}"))?;
    Ok(dir.join("velora.log"))
}

/// 追加一条日志(前端错误上报 + Rust 侧错误)
#[tauri::command]
fn log_write(app: tauri::AppHandle, level: String, message: String) -> Result<(), String> {
    use std::io::Write;
    let path = log_path(&app)?;
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("打开日志失败: {e}"))?;
    let time = chrono_now();
    writeln!(file, "[{time}] [{level}] {message}").ok();
    Ok(())
}

/// 读取日志(开发模式面板用)
#[tauri::command]
fn log_read(app: tauri::AppHandle, tail_lines: Option<usize>) -> Result<String, String> {
    let path = log_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(content) => {
            let n = tail_lines.unwrap_or(200);
            let lines: Vec<&str> = content.lines().collect();
            let start = lines.len().saturating_sub(n);
            Ok(lines[start..].join("\n"))
        }
        Err(_) => Ok(String::new()),
    }
}

/// 清空日志
#[tauri::command]
fn log_clear(app: tauri::AppHandle) -> Result<(), String> {
    let path = log_path(&app)?;
    let _ = std::fs::write(&path, "");
    Ok(())
}

/// 返回日志文件绝对路径(开发模式:打开日志)
#[tauri::command]
fn log_file_path(app: tauri::AppHandle) -> Result<String, String> {
    log_path(&app)?
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "日志路径含非法字符".to_string())
}

/// 轻量时间戳(不引 chrono,用 SystemTime)
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 简单格式:unix 秒(前端可格式化,或直接看)。够日志用。
    format!("t{secs}")
}


#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("读取文件失败 {path}: {e}"))
}

// 原子写:同目录临时文件 + fsync + rename。
// 崩溃时要么旧文件完整、要么新文件完整,不会半写损坏。
// 同目录保证 rename 是原子操作(跨文件系统 rename 会降级为复制+删除)。
fn atomic_write(path: &Path, content: &str) -> Result<(), String> {
    use std::io::Write;
    let dir = path
        .parent()
        .ok_or_else(|| format!("无效路径 {path:?}"))?;
    // 临时文件:同目录,隐藏前缀,带 pid 防并发碰撞
    let tmp_name = format!(
        ".velora-tmp-{}-{}",
        path.file_name().and_then(|n| n.to_str()).unwrap_or("doc"),
        std::process::id()
    );
    let tmp_path = dir.join(&tmp_name);

    // 1. 写临时文件
    let mut file = std::fs::File::create(&tmp_path)
        .map_err(|e| format!("创建临时文件失败 {tmp_path:?}: {e}"))?;
    file.write_all(content.as_bytes())
        .map_err(|e| format!("写入临时文件失败: {e}"))?;
    // 2. fsync 持久化(崩溃后数据仍在磁盘)
    file.sync_all()
        .map_err(|e| format!("fsync 失败: {e}"))?;
    drop(file);
    // 3. rename 覆盖目标(同目录原子)
    std::fs::rename(&tmp_path, path).map_err(|e| {
        // rename 失败清理临时文件
        let _ = std::fs::remove_file(&tmp_path);
        format!("rename 失败: {e}")
    })
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    atomic_write(Path::new(&path), &content)
}

// ── 崩溃恢复草稿(未保存文档的会话快照,存 app data 目录) ────────────

#[tauri::command]
fn recovery_load(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = recovery_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(content) if !content.is_empty() => Ok(Some(content)),
        Ok(_) => Ok(None),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn recovery_save(app: tauri::AppHandle, content: String) -> Result<(), String> {
    let path = recovery_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建恢复目录失败: {e}"))?;
    }
    atomic_write(&path, &content)
}

#[tauri::command]
fn recovery_clear(app: tauri::AppHandle) -> Result<(), String> {
    let path = recovery_path(&app)?;
    let _ = std::fs::remove_file(&path);
    Ok(())
}

fn recovery_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("获取 app data 目录失败: {e}"))?;
    Ok(dir.join("recovery-draft.md"))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<DirEntry>>,
}

/// 目录遍历时跳过的名字
const SKIP_NAMES: &[&str] = &["node_modules", "target", "dist", ".git", ".idea", ".vscode"];

fn walk_dir(dir: &Path, depth: usize, max_depth: usize) -> Result<Vec<DirEntry>, String> {
    let mut entries: Vec<DirEntry> = Vec::new();
    let read_dir =
        std::fs::read_dir(dir).map_err(|e| format!("读取目录失败 {}: {e}", dir.display()))?;

    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || SKIP_NAMES.contains(&name.as_str()) {
            continue;
        }
        let path = entry.path();
        let is_dir = path.is_dir();
        let children = if is_dir && depth < max_depth {
            Some(walk_dir(&path, depth + 1, max_depth)?)
        } else if is_dir {
            Some(Vec::new())
        } else {
            None
        };
        entries.push(DirEntry {
            name,
            path: path.to_string_lossy().to_string(),
            is_dir,
            children,
        });
    }

    // 目录在前,文件在后,各自按名称排序(大小写不敏感)
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
fn read_dir_tree(path: String, max_depth: Option<usize>) -> Result<Vec<DirEntry>, String> {
    walk_dir(Path::new(&path), 0, max_depth.unwrap_or(8))
}

// ── Git(经系统 git CLI,不引第三方 crate) ─────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitChange {
    /// porcelain 状态码: M / A / D / ?? 等
    status: String,
    path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitStatus {
    is_repo: bool,
    branch: String,
    changes: Vec<GitChange>,
}

fn run_git(root: &str, args: &[&str]) -> Result<String, String> {
    let output = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .output()
        .map_err(|e| format!("执行 git 失败: {e}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

#[tauri::command]
fn git_status(root: String) -> Result<GitStatus, String> {
    let branch = run_git(&root, &["branch", "--show-current"]).unwrap_or_default();
    let porcelain = match run_git(&root, &["status", "--porcelain=v1"]) {
        Ok(s) => s,
        Err(e) => {
            // 不是 git 仓库不算错误,返回 is_repo=false
            if e.contains("not a git repository") {
                return Ok(GitStatus {
                    is_repo: false,
                    branch: String::new(),
                    changes: Vec::new(),
                });
            }
            return Err(e);
        }
    };
    let changes = porcelain
        .lines()
        .filter(|l| l.len() > 3)
        .map(|l| GitChange {
            status: l[..2].trim().to_string(),
            path: l[3..].trim().trim_matches('"').to_string(),
        })
        .collect();
    Ok(GitStatus {
        is_repo: true,
        branch: branch.trim().to_string(),
        changes,
    })
}

#[tauri::command]
fn git_commit_all(root: String, message: String) -> Result<String, String> {
    run_git(&root, &["add", "-A"])?;
    run_git(&root, &["commit", "-m", &message])
}

#[tauri::command]
fn git_diff(root: String, path: String) -> Result<String, String> {
    // 工作区 + 暂存区合并视图
    run_git(&root, &["diff", "HEAD", "--", &path])
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GitCommit {
    hash: String,
    author: String,
    date: String,
    message: String,
}

/// 文件提交历史(可选限定 path)。返回精简列表供前端展示。
#[tauri::command]
fn git_log(root: String, path: Option<String>) -> Result<Vec<GitCommit>, String> {
    // 格式:用 ASCII 分隔符避免消息含特殊字符干扰
    // %h 短 hash | %an 作者 | %ad 日期 | %s 消息(首行)
    let format = "--pretty=format:%h%x09%an%x09%ad%x09%s%x0a";
    let mut args = vec!["log", format, "--date=short", "-n", "200"];
    if let Some(p) = &path {
        args.push("--");
        args.push(p);
    }
    let out = run_git(&root, &args)?;
    let commits = out
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            let parts: Vec<&str> = l.split('\t').collect();
            GitCommit {
                hash: parts.first().map(|s| s.to_string()).unwrap_or_default(),
                author: parts.get(1).map(|s| s.to_string()).unwrap_or_default(),
                date: parts.get(2).map(|s| s.to_string()).unwrap_or_default(),
                message: parts.get(3).map(|s| s.to_string()).unwrap_or_default(),
            }
        })
        .collect();
    Ok(commits)
}

/// 查看某次 commit 对某文件的改动 diff
#[tauri::command]
fn git_show(root: String, hash: String, path: String) -> Result<String, String> {
    run_git(&root, &["show", &format!("{hash}"), "--", &path])
}

// ── 文件监听(notify crate,事件经 Tauri event 推给前端) ──────────────

use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use tauri::State;

struct WatcherState(Mutex<Option<notify::RecommendedWatcher>>);

#[tauri::command]
fn watch_dir(
    app: AppHandle,
    state: State<WatcherState>,
    path: String,
) -> Result<(), String> {
    // 停掉旧 watcher
    if let Ok(mut guard) = state.0.lock() {
        *guard = None;
    }

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(move |res: Result<notify::Event, notify::Error>| {
        if let Ok(event) = res {
            // 只转发有路径的事件;前端自行去抖
            let paths: Vec<String> = event
                .paths
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            if !paths.is_empty() {
                let _ = app_handle.emit("velora-fs-change", paths);
            }
        }
    })
    .map_err(|e| format!("创建文件监听器失败: {e}"))?;

    notify::Watcher::watch(&mut watcher, Path::new(&path), notify::RecursiveMode::Recursive)
        .map_err(|e| format!("监听目录失败 {path}: {e}"))?;

    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(watcher);
    }
    Ok(())
}

#[tauri::command]
fn unwatch_dir(state: State<WatcherState>) -> Result<(), String> {
    if let Ok(mut guard) = state.0.lock() {
        *guard = None;
    }
    Ok(())
}

// ── HTTP 代理(AI 请求走 Rust,绕开 WebView CORS 限制) ──────────────

#[tauri::command]
async fn http_request(
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
) -> Result<String, String> {
    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("content-type", "application/json")
        .body(body);
    for (key, value) in headers {
        req = req.header(&key, &value);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("网络请求失败({url}): {e}"))?;
    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        let snippet: String = text.chars().take(300).collect();
        return Err(format!("API 错误 {}({url}): {snippet}", status.as_u16()));
    }
    Ok(text)
}

// ── HTTP 流式(AI SSE 走 Rust,经 Channel 逐块推前端) ────────────────

use futures_util::StreamExt;
use tauri::ipc::Channel;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase", tag = "type")]
enum StreamChunk {
    /// 一段原始 SSE/分块文本(前端自行解析协议)
    Data { text: String },
    /// 流结束
    Done,
}

/// 流式 HTTP POST:逐块读响应体,经 Channel 推给前端。
/// 前端拿到的每段 text 含 SSE 协议行,自行解析增量子事件。
#[tauri::command]
async fn http_stream(
    url: String,
    headers: std::collections::HashMap<String, String>,
    body: String,
    on_chunk: Channel<StreamChunk>,
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let mut req = client
        .post(&url)
        .header("content-type", "application/json")
        .body(body);
    for (key, value) in headers {
        req = req.header(&key, &value);
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("网络请求失败({url}): {e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        let snippet: String = text.chars().take(300).collect();
        return Err(format!("API 错误 {}({url}): {snippet}", status.as_u16()));
    }
    let mut stream = resp.bytes_stream();
    while let Some(chunk) = stream
        .next()
        .await
        .transpose()
        .map_err(|e| format!("读取流失败: {e}"))?
    {
        let text = String::from_utf8_lossy(&chunk).to_string();
        if text.is_empty() {
            continue;
        }
        let _ = on_chunk.send(StreamChunk::Data { text });
    }
    let _ = on_chunk.send(StreamChunk::Done);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .manage(WatcherState(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            read_dir_tree,
            git_status,
            git_commit_all,
            git_diff,
            git_log,
            git_show,
            watch_dir,
            unwatch_dir,
            http_request,
            http_stream,
            recovery_load,
            recovery_save,
            recovery_clear,
            log_write,
            log_read,
            log_clear,
            log_file_path
        ])
        .setup(|_app| {
            // Windows/Linux:双击文件启动时路径在 argv 里(首个非程序自身参数)
            #[cfg(not(target_os = "macos"))]
            {
                let files: Vec<String> = std::env::args()
                    .skip(1)
                    .filter(|a| !a.starts_with('-'))
                    .filter(|a| Path::new(a).is_file())
                    .collect();
                if !files.is_empty() {
                    emit_to_target_window(_app, &files);
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            // macOS:双击文件/Finder「打开方式」走 Opened 事件
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                let files: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().to_string())
                    .collect();
                if !files.is_empty() {
                    emit_to_target_window(_app, &files);
                }
            }
        });
}

/// 系统打开请求路由到单个窗口:聚焦窗口优先(用户正在看的窗口响应,
/// 与拖拽/⌘O 的直觉一致);冷启动无聚焦窗口时回落到主窗口 "main"。
fn emit_to_target_window(app: &tauri::AppHandle, files: &[String]) {
    let payload = files.join("\u{1f}");
    let windows = app.webview_windows();
    let target = windows
        .values()
        .find(|w| w.is_focused().unwrap_or(false))
        .cloned()
        .or_else(|| app.get_webview_window("main"));
    if let Some(win) = target {
        let _ = win.emit_to(win.label(), "system-open-path", payload);
    }
}
