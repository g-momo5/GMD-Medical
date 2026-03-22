// GMD Medical Platform - Tauri Backend

use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command]
fn convert_docx_to_pdf(docx_path: String) -> Result<String, String> {
    let input_path = PathBuf::from(docx_path.trim());
    if !input_path.exists() {
        return Err("Il file DOCX non esiste.".to_string());
    }

    let extension = input_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .unwrap_or_default();
    if extension != "docx" {
        return Err("Il file selezionato non è un DOCX valido.".to_string());
    }

    let out_dir = input_path
        .parent()
        .ok_or_else(|| "Impossibile risolvere la cartella di output.".to_string())?;
    let file_stem = input_path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .ok_or_else(|| "Nome file DOCX non valido.".to_string())?;
    let output_pdf = out_dir.join(format!("{file_stem}.pdf"));

    if output_pdf.exists() {
        let _ = std::fs::remove_file(&output_pdf);
    }

    let mut attempts: Vec<String> = Vec::new();

    #[cfg(target_os = "macos")]
    {
        match convert_with_word_applescript(&input_path, &output_pdf) {
            Ok(()) if output_pdf.exists() => return Ok(path_to_string(&output_pdf)),
            Ok(()) => attempts.push(
                "Microsoft Word (AppleScript): conversione eseguita ma PDF non trovato".to_string(),
            ),
            Err(error) => attempts.push(format!("Microsoft Word (AppleScript): {error}")),
        }
    }

    for soffice in soffice_candidates() {
        let result = Command::new(&soffice)
            .arg("--headless")
            .arg("--nologo")
            .arg("--nolockcheck")
            .arg("--convert-to")
            .arg("pdf")
            .arg("--outdir")
            .arg(out_dir)
            .arg(&input_path)
            .output();

        match result {
            Ok(output) if output.status.success() => {
                if output_pdf.exists() {
                    return Ok(path_to_string(&output_pdf));
                }

                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                attempts.push(format!(
                    "{soffice}: conversione eseguita ma PDF non trovato{}",
                    if stderr.is_empty() {
                        String::new()
                    } else {
                        format!(" (stderr: {stderr})")
                    }
                ));
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                attempts.push(format!(
                    "{soffice}: exit {}{}{}",
                    output.status.code().unwrap_or(-1),
                    if stderr.is_empty() {
                        String::new()
                    } else {
                        format!(", stderr: {stderr}")
                    },
                    if stdout.is_empty() {
                        String::new()
                    } else {
                        format!(", stdout: {stdout}")
                    }
                ));
            }
            Err(error) => {
                attempts.push(format!("{soffice}: {error}"));
            }
        }
    }

    Err(format!(
        "Impossibile convertire il DOCX in PDF. Verifica LibreOffice o Microsoft Word. Dettagli: {}",
        attempts.join(" | ")
    ))
}

fn soffice_candidates() -> Vec<String> {
    let mut candidates = vec![
        "/Applications/LibreOffice.app/Contents/MacOS/soffice".to_string(),
        "soffice".to_string(),
        "libreoffice".to_string(),
    ];

    if cfg!(target_os = "windows") {
        candidates.insert(
            0,
            "C:\\Program Files\\LibreOffice\\program\\soffice.exe".to_string(),
        );
        candidates.insert(
            1,
            "C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe".to_string(),
        );
    }

    candidates
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(target_os = "macos")]
fn convert_with_word_applescript(input_path: &Path, output_pdf: &Path) -> Result<(), String> {
    let script_lines = [
        "on run argv",
        "set inputPath to item 1 of argv",
        "set outputPath to item 2 of argv",
        "tell application \"Microsoft Word\"",
        "set previousVisibility to visible",
        "set visible to false",
        "set docRef to open POSIX file inputPath",
        "save as docRef file name POSIX file outputPath file format format PDF",
        "close docRef saving no",
        "set visible to previousVisibility",
        "end tell",
        "end run",
    ];

    let mut command = Command::new("osascript");
    for line in script_lines {
        command.arg("-e").arg(line);
    }
    command
        .arg(path_to_string(input_path))
        .arg(path_to_string(output_pdf));

    let output = command
        .output()
        .map_err(|error| format!("Impossibile eseguire osascript: {error}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Err(format!(
        "exit {}{}{}",
        output.status.code().unwrap_or(-1),
        if stderr.is_empty() {
            String::new()
        } else {
            format!(", stderr: {stderr}")
        },
        if stdout.is_empty() {
            String::new()
        } else {
            format!(", stdout: {stdout}")
        }
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![convert_docx_to_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
