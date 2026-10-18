Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression

$projectRoot = Split-Path -Parent $PSScriptRoot
$moduleRoot = Join-Path $projectRoot 'magisk\shenfa-core'
$distRoot = Join-Path $projectRoot 'dist'
$output = Join-Path $distRoot 'shenfa-core-v0.4.1.zip'

if (-not (Test-Path -LiteralPath (Join-Path $moduleRoot 'module.prop'))) {
  throw "Magisk 模块目录不完整：$moduleRoot"
}

New-Item -ItemType Directory -Force -Path $distRoot | Out-Null
if (Test-Path -LiteralPath $output) {
  Remove-Item -LiteralPath $output -Force
}

$files = @(
  @{ Path = 'module.prop'; Mode = 0x1A4 },
  @{ Path = 'action.sh'; Mode = 0x1ED },
  @{ Path = 'service.sh'; Mode = 0x1ED },
  @{ Path = 'uninstall.sh'; Mode = 0x1ED },
  @{ Path = 'config/default.conf'; Mode = 0x1A4 },
  @{ Path = 'bin/shenfa-module'; Mode = 0x1ED },
  @{ Path = 'bin/bill-scan.sh'; Mode = 0x1ED }
)

$archiveStream = [System.IO.File]::Open($output, [System.IO.FileMode]::CreateNew)
$archive = [System.IO.Compression.ZipArchive]::new($archiveStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
try {
  foreach ($file in $files) {
    $source = Join-Path $moduleRoot $file.Path
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
      throw "模块文件不存在：$source"
    }
    $entry = $archive.CreateEntry($file.Path.Replace('\', '/'), [System.IO.Compression.CompressionLevel]::Optimal)
    $entry.ExternalAttributes = [int]($file.Mode -shl 16)
    $input = [System.IO.File]::OpenRead($source)
    try {
      $outputStream = $entry.Open()
      try {
        $input.CopyTo($outputStream)
      }
      finally {
        $outputStream.Dispose()
      }
    }
    finally {
      $input.Dispose()
    }
  }
}
finally {
  $archive.Dispose()
  $archiveStream.Dispose()
}

if (-not (Test-Path -LiteralPath $output)) {
  throw "未生成 Magisk 模块包：$output"
}

Write-Output "Magisk 模块已生成：$output"
