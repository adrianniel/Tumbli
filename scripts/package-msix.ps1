<#
.SYNOPSIS
  Packages the release build of Tumbli as an .msix for the Microsoft Store.

.DESCRIPTION
  1. Run `npm run tauri build` first (this script packs src-tauri\target\release\tumbli.exe).
  2. Put your Partner Center product identity in packaging\msix\identity.json.
  3. Run:  powershell -ExecutionPolicy Bypass -File scripts\package-msix.ps1

  The Store signs the package when you submit it, so the .msix is left unsigned.
  For a local install test, pass -TestSign: it creates (once) a self-signed certificate
  for the publisher in identity.json and signs the package with it. Installing that test
  package also needs the certificate trusted on the machine (see the message it prints).

.OUTPUTS
  dist-msix\Tumbli_<version>_x64.msix
#>
param(
  [switch]$TestSign
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

# ---------- tools from the Windows SDK ----------
$sdkBin = Get-ChildItem "${env:ProgramFiles(x86)}\Windows Kits\10\bin" -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^\d+\.\d+\.\d+\.\d+$' -and (Test-Path (Join-Path $_.FullName "x64\makeappx.exe")) } |
  Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
if (-not $sdkBin) { throw "Windows SDK not found. Install it with the Visual Studio Build Tools (Windows 11 SDK)." }
$tools = Join-Path $sdkBin.FullName "x64"
$makeappx = Join-Path $tools "makeappx.exe"
$makepri = Join-Path $tools "makepri.exe"
$signtool = Join-Path $tools "signtool.exe"

# ---------- inputs ----------
$conf = Get-Content "src-tauri\tauri.conf.json" -Raw | ConvertFrom-Json
$identity = Get-Content "packaging\msix\identity.json" -Raw | ConvertFrom-Json
$parts = ($conf.version -split '[.-]')[0..2]
$version = "{0}.{1}.{2}.0" -f $parts[0], $parts[1], $parts[2] # Store wants the 4th part to be 0

$exe = "src-tauri\target\release\tumbli.exe"
if (-not (Test-Path $exe)) { throw "Missing $exe. Run 'npm run tauri build' first." }
if ($identity.identityName -like "*Placeholder*") {
  Write-Warning "identity.json still has placeholder values. Fine for a local test, but the Store will reject it."
}

# ---------- stage ----------
$stage = "src-tauri\target\msix\stage"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Force "$stage\Assets" | Out-Null
Copy-Item $exe $stage
foreach ($icon in "StoreLogo", "Square44x44Logo", "Square71x71Logo", "Square150x150Logo") {
  Copy-Item "src-tauri\icons\$icon.png" "$stage\Assets\$icon.png"
}

$manifest = Get-Content "packaging\msix\AppxManifest.template.xml" -Raw
$manifest = $manifest.
  Replace("{{IDENTITY_NAME}}", $identity.identityName).
  Replace("{{PUBLISHER}}", $identity.publisher).
  Replace("{{PUBLISHER_DISPLAY_NAME}}", $identity.publisherDisplayName).
  Replace("{{DISPLAY_NAME}}", $identity.displayName).
  Replace("{{VERSION}}", $version)
Set-Content "$stage\AppxManifest.xml" $manifest -Encoding UTF8

# ---------- resources.pri ----------
$priConfig = "src-tauri\target\msix\priconfig.xml"
& $makepri createconfig /cf $priConfig /dq en-US /o | Out-Null
& $makepri new /pr $stage /cf $priConfig /of "$stage\resources.pri" /o | Out-Null
if ($LASTEXITCODE -ne 0) { throw "makepri failed" }

# ---------- pack ----------
New-Item -ItemType Directory -Force "dist-msix" | Out-Null
$out = "dist-msix\Tumbli_$($version)_x64.msix"
& $makeappx pack /d $stage /p $out /o | Out-Null
if ($LASTEXITCODE -ne 0) { throw "makeappx failed" }
Write-Host "Packed $out"

# ---------- optional local test signing ----------
if ($TestSign) {
  $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $identity.publisher } | Select-Object -First 1
  if (-not $cert) {
    $cert = New-SelfSignedCertificate -Type Custom -Subject $identity.publisher -KeyUsage DigitalSignature `
      -FriendlyName "Tumbli test signing" -CertStoreLocation "Cert:\CurrentUser\My" `
      -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")
  }
  & $signtool sign /fd SHA256 /sha1 $cert.Thumbprint $out
  if ($LASTEXITCODE -ne 0) { throw "signtool failed" }
  Write-Host "Signed with test certificate $($cert.Thumbprint)."
  Write-Host "To install it, trust that certificate first (Local Machine > Trusted People), then double-click the .msix."
}
