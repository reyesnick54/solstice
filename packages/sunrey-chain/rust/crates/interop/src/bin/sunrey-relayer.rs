use sunrey_interop::cli::run_relayer_command;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    match run_relayer_command(&args) {
        Ok(out) => println!("{out}"),
        Err(err) => {
            eprintln!("error: {err}");
            std::process::exit(1);
        }
    }
}
