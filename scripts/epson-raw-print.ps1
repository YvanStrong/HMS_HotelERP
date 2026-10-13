param(
  [string]$FilePath = "",
  [string]$PrinterName = "",
  [switch]$List
)

$ErrorActionPreference = "Stop"

function Get-ReceiptPrinters {
  $rows = @(Get-CimInstance -ClassName Win32_Printer -ErrorAction SilentlyContinue)
  $virtual = 'PDF|XPS|OneNote|Fax|Send To|Microsoft Print|Adobe|Snagit|CutePDF|Foxit'
  foreach ($p in $rows) {
    $name = [string]$p.Name
    $port = [string]$p.PortName
    $driver = [string]$p.DriverName
    $isVirtual = ($name -match $virtual) -or ($driver -match $virtual) -or ($port -match 'PORTPROMPT|nul:|FILE:|SHRFAX')
    $usb = $port -match '^(USB|DOT4|TS)' -or $name -match 'Xprinter|X-printer|XP-|POS-?80|POS-?58|Receipt|EPSON|TM-|Thermal|80mm'
    [pscustomobject]@{
      Name = $name
      Port = $port
      Driver = $driver
      Usb = [bool]$usb
      Virtual = [bool]$isVirtual
    }
  }
}

function Select-ReceiptPrinter([string]$Preferred) {
  $all = @(Get-ReceiptPrinters)
  if ($Preferred) {
    $hit = $all | Where-Object { $_.Name -eq $Preferred } | Select-Object -First 1
    if ($hit) { return $hit.Name }
  }
  $real = @($all | Where-Object { -not $_.Virtual })
  $named = $real | Where-Object { $_.Name -match 'Xprinter|X-printer|XP-|POS-?80|POS-?58|Receipt|EPSON|TM-|Thermal|80mm' } | Select-Object -First 1
  if ($named) { return $named.Name }
  $usb = $real | Where-Object { $_.Usb } | Select-Object -First 1
  if ($usb) { return $usb.Name }
  if ($real.Count -eq 1) { return $real[0].Name }
  return $null
}

if ($List) {
  $all = @(Get-ReceiptPrinters | Where-Object { -not $_.Virtual })
  $selected = Select-ReceiptPrinter $PrinterName
  $payload = @{
    selected = $selected
    printers = @($all | ForEach-Object { @{ name = $_.Name; port = $_.Port; driver = $_.Driver } })
  }
  $payload | ConvertTo-Json -Compress -Depth 4
  exit 0
}

if (-not $FilePath) { throw "Print file missing" }
if (-not (Test-Path $FilePath)) { throw "Print file missing: $FilePath" }

if (-not $PrinterName) {
  $PrinterName = Select-ReceiptPrinter ""
}
if (-not $PrinterName) {
  throw "No Xprinter is installed in Windows. Plug in the USB cable, wait until Windows shows the printer, then print again."
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class HmsRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
  }
  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);
  public static void Send(string printer, byte[] bytes) {
    IntPtr h = IntPtr.Zero;
    if (!OpenPrinter(printer.Normalize(), out h, IntPtr.Zero)) throw new Exception("OpenPrinter failed for " + printer);
    try {
      DOCINFOA di = new DOCINFOA();
      di.pDocName = "HMS Receipt";
      di.pDataType = "RAW";
      if (!StartDocPrinter(h, 1, di)) throw new Exception("StartDocPrinter failed");
      StartPagePrinter(h);
      IntPtr p = Marshal.AllocHGlobal(bytes.Length);
      try {
        Marshal.Copy(bytes, 0, p, bytes.Length);
        int written;
        if (!WritePrinter(h, p, bytes.Length, out written)) throw new Exception("WritePrinter failed");
      } finally { Marshal.FreeHGlobal(p); }
      EndPagePrinter(h);
      EndDocPrinter(h);
    } finally { ClosePrinter(h); }
  }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
[HmsRawPrinter]::Send($PrinterName, $bytes)
Write-Output "OK $PrinterName $($bytes.Length) bytes"
