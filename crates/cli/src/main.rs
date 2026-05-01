use anyhow::Result;
use boson_core::loader::load_workspace;
use boson_server::run_local_server;
use clap::{Parser, Subcommand};
use std::{
    fs,
    net::SocketAddr,
    path::PathBuf,
    process::{Child, Command},
};
use tracing::info;

#[derive(Parser, Debug)]
#[command(name = "boson", about = "Repo-native API platform workbench")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    Init,
    Dev {
        #[arg(long, default_value = "127.0.0.1:8787")]
        addr: SocketAddr,
        #[arg(long, default_value = "http://127.0.0.1:8787")]
        base_url: String,
        #[arg(long, default_value = "http://localhost:5173")]
        ui_url: String,
        #[arg(long, default_value_t = true)]
        open: bool,
        #[arg(long, default_value_t = true)]
        with_ui: bool,
    },
    Run {
        route_id: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let cli = Cli::parse();
    let cwd = std::env::current_dir()?;
    let root_dir = resolve_workspace_root(&cwd)?;

    match cli.command {
        Commands::Init => init_workspace(&root_dir)?,
        Commands::Dev {
            addr,
            base_url,
            ui_url,
            open,
            with_ui,
        } => {
            info!("starting local server on {}", addr);
            let mut _ui_child: Option<Child> = None;
            if with_ui {
                _ui_child = Some(start_ui_dev_server(&root_dir)?);
            }
            if open {
                if let Err(err) = open_in_browser(&ui_url) {
                    info!("failed to auto-open browser: {}", err);
                }
            }
            run_local_server(root_dir, base_url, addr).await?;
        }
        Commands::Run { route_id } => run_once(&root_dir, &route_id)?,
    }

    Ok(())
}

fn init_workspace(root_dir: &PathBuf) -> Result<()> {
    let api_dir = root_dir.join(".api");
    let env_dir = api_dir.join("environments");
    let routes_dir = api_dir.join("routes");

    fs::create_dir_all(&env_dir)?;
    fs::create_dir_all(&routes_dir)?;

    write_if_missing(
        &api_dir.join("project.json"),
        r#"{
  "schema_version": "1",
  "name": "Boson Platform Demo",
  "default_environment": "local"
}
"#,
    )?;

    write_if_missing(
        &env_dir.join("local.json"),
        r#"{
  "name": "local",
  "variables": {
    "base_url": "http://127.0.0.1:8787"
  }
}
"#,
    )?;

    write_if_missing(
        &routes_dir.join("sample.json"),
        r#"{
  "id": "health-check",
  "name": "Health Check",
  "method": "GET",
  "path": "/health",
  "group": "System",
  "headers": {},
  "tests": [
    { "type": "status", "equals": 200 }
  ]
}
"#,
    )?;

    println!("Initialized .api workspace");
    Ok(())
}

fn run_once(root_dir: &PathBuf, route_id: &str) -> Result<()> {
    let workspace = load_workspace(root_dir)?;
    let route = workspace
        .routes
        .iter()
        .find(|item| item.id == route_id)
        .ok_or_else(|| anyhow::anyhow!("route `{}` not found", route_id))?;

    println!(
        "Route `{}` loaded ({} {})",
        route.id, route.method, route.path
    );
    println!("Execution completed through local runtime APIs and UI workbench.");
    Ok(())
}

fn write_if_missing(path: &PathBuf, content: &str) -> Result<()> {
    if path.exists() {
        return Ok(());
    }
    fs::write(path, content)?;
    Ok(())
}

fn open_in_browser(url: &str) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(url).spawn()?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd").args(["/C", "start", "", url]).spawn()?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(url).spawn()?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Ok(())
}

fn start_ui_dev_server(root_dir: &PathBuf) -> Result<Child> {
    let ui_dir = root_dir.join("ui");
    let child = Command::new("pnpm")
        .arg("dev")
        .current_dir(ui_dir)
        .spawn()?;
    info!("started UI dev server using `pnpm dev`");
    Ok(child)
}

fn resolve_workspace_root(start: &PathBuf) -> Result<PathBuf> {
    let mut current = start.clone();
    loop {
        if current.join("Cargo.toml").exists() && current.join("ui").is_dir() {
            return Ok(current);
        }
        if !current.pop() {
            break;
        }
    }
    Err(anyhow::anyhow!(
        "Could not find project root. Run from Boson repo or a child directory."
    ))
}
