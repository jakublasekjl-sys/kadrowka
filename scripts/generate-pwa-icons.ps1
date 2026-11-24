$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$sourcePath = (Resolve-Path (Join-Path $projectRoot 'public\kadrowka-logo-v2.png')).Path
$targetRoot = Join-Path $projectRoot 'public\icons'
New-Item -ItemType Directory -Force -Path $targetRoot | Out-Null

function Save-Icon {
    param(
        [int]$Size,
        [string]$FileName,
        [double]$Scale = 1.0
    )

    $source = [System.Drawing.Image]::FromFile($sourcePath)
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#5B2A86'))
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $imageSize = [int][Math]::Round($Size * $Scale)
        $offset = [int][Math]::Round(($Size - $imageSize) / 2)
        $graphics.DrawImage($source, $offset, $offset, $imageSize, $imageSize)
        $bitmap.Save((Join-Path $targetRoot $FileName), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
        $source.Dispose()
    }
}

Save-Icon -Size 64 -FileName '..\favicon-v2.png' -Scale 0.88
Save-Icon -Size 192 -FileName 'icon-192-v2.png' -Scale 0.92
Save-Icon -Size 512 -FileName 'icon-512-v2.png' -Scale 0.92
Save-Icon -Size 512 -FileName 'icon-maskable-512-v2.png' -Scale 0.78
Save-Icon -Size 180 -FileName 'apple-touch-icon-180-v2.png' -Scale 0.86

Write-Output "Wygenerowano ikony PWA w $targetRoot"
