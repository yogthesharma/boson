use anyhow::Result;
use clap::{Parser, Subcommand};
use routepad_core::loader::load_workspace;
use routepad_server::run_local_server;
use std::{fs, net::SocketAddr, path::PathBuf};
use tracing::info;

#[derive(Parser, Debug)]
#[command(name = "routepad", about = "Repo-native API workspace")]
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
        #[arg(long, default_value = "http://localhost:3000")]
        base_url: String,
    },
    Run {
        route_id: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt().with_env_filter("info").init();

    let cli = Cli::parse();
    let root_dir = std::env::current_dir()?;

    match cli.command {
        Commands::Init => init_workspace(&root_dir)?,
        Commands::Dev { addr, base_url } => {
            info!("starting local server on {}", addr);
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
  "name": "Routepad Project",
  "default_environment": "local"
}
"#,
    )?;

    write_if_missing(
        &env_dir.join("local.json"),
        r#"{
  "name": "local",
  "variables": {
    "base_url": "http://localhost:3000"
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
    println!("Execution via direct CLI will be wired in next step.");
    Ok(())
}

fn write_if_missing(path: &PathBuf, content: &str) -> Result<()> {
    if path.exists() {
        return Ok(());
    }
    fs::write(path, content)?;
    Ok(())
}
