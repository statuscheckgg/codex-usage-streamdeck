param(
    [string] $OutputDir = (Join-Path $PSScriptRoot "..\marketplace-assets")
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

function New-Bitmap($path, [scriptblock] $draw) {
    $bmp = [System.Drawing.Bitmap]::new(1920, 960)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $draw.Invoke($g)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

function Brush($hex) {
    [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($hex))
}

function Pen($hex, $width) {
    $p = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($hex), $width)
    $p.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $p.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $p
}

function Font($size, $style = [System.Drawing.FontStyle]::Regular) {
    [System.Drawing.Font]::new("Arial", $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Text($g, $text, $x, $y, $size, $color, $style = [System.Drawing.FontStyle]::Regular, $align = "Near") {
    $font = Font $size $style
    $brush = Brush $color
    $format = [System.Drawing.StringFormat]::new()
    if ($align -eq "Center") { $format.Alignment = [System.Drawing.StringAlignment]::Center }
    if ($align -eq "Far") { $format.Alignment = [System.Drawing.StringAlignment]::Far }
    $g.DrawString($text, $font, $brush, [System.Drawing.PointF]::new($x, $y), $format)
    $font.Dispose()
    $brush.Dispose()
    $format.Dispose()
}

function RoundRectPath($x, $y, $w, $h, $r) {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = $r * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $path
}

function FillRound($g, $x, $y, $w, $h, $r, $color) {
    $brush = Brush $color
    if ($r -le 0) {
        $g.FillRectangle($brush, $x, $y, $w, $h)
        $brush.Dispose()
        return
    }
    $path = RoundRectPath $x $y $w $h $r
    $g.FillPath($brush, $path)
    $brush.Dispose()
    $path.Dispose()
}

function DrawBarKey($g, $x, $y, $scale, $five, $week, $level = "green") {
    $accent = if ($level -eq "red") { "#ff335d" } elseif ($level -eq "yellow") { "#f6d84d" } else { "#34e977" }
    $panel = if ($level -eq "red") { "#1d1421" } else { "#111a25" }
    FillRound $g $x $y (300*$scale) (300*$scale) (52*$scale) $panel
    Text $g "$five%" ($x+48*$scale) ($y+55*$scale) (58*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "5H" ($x+230*$scale) ($y+41*$scale) (38*$scale) $accent ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "4h" ($x+230*$scale) ($y+91*$scale) (32*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold) "Center"
    $track = Pen "#263241" (14*$scale)
    $pen = Pen $accent (14*$scale)
    $g.DrawLine($track, $x+50*$scale, $y+140*$scale, $x+247*$scale, $y+140*$scale)
    $g.DrawLine($pen, $x+50*$scale, $y+140*$scale, $x+(50+1.97*$five)*$scale, $y+140*$scale)
    Text $g "$week%" ($x+48*$scale) ($y+178*$scale) (58*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "WK" ($x+230*$scale) ($y+164*$scale) (38*$scale) $accent ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "6d" ($x+230*$scale) ($y+214*$scale) (32*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold) "Center"
    $g.DrawLine($track, $x+50*$scale, $y+265*$scale, $x+247*$scale, $y+265*$scale)
    $g.DrawLine($pen, $x+50*$scale, $y+265*$scale, $x+(50+1.97*$week)*$scale, $y+265*$scale)
    $track.Dispose()
    $pen.Dispose()
}

function DrawRingKey($g, $x, $y, $scale, $value, $level = "green") {
    $accent = if ($level -eq "red") { "#ff335d" } elseif ($level -eq "yellow") { "#f6d84d" } else { "#34e977" }
    FillRound $g $x $y (300*$scale) (300*$scale) (52*$scale) "#111a25"
    $track = Pen "#263241" (22*$scale)
    $pen = Pen $accent (22*$scale)
    $rect = [System.Drawing.RectangleF]::new($x+48*$scale, $y+48*$scale, 204*$scale, 204*$scale)
    $g.DrawArc($track, $rect, 130, 280)
    $g.DrawArc($pen, $rect, 130, 280*($value/100))
    Text $g "$value%" ($x+150*$scale) ($y+118*$scale) (58*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "5H" ($x+150*$scale) ($y+178*$scale) (31*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "4h" ($x+150*$scale) ($y+222*$scale) (31*$scale) "#f6fff8" ([System.Drawing.FontStyle]::Bold) "Center"
    $track.Dispose()
    $pen.Dispose()
}

function DrawWarningKey($g, $x, $y, $scale) {
    FillRound $g $x $y (300*$scale) (300*$scale) (52*$scale) "#1d1421"
    Text $g "OH NO" ($x+150*$scale) ($y+42*$scale) (36*$scale) "#ff335d" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "8%" ($x+150*$scale) ($y+103*$scale) (94*$scale) "#fff8fb" ([System.Drawing.FontStyle]::Bold) "Center"
    $track = Pen "#34303f" (18*$scale)
    $pen = Pen "#ff335d" (18*$scale)
    $g.DrawLine($track, $x+70*$scale, $y+218*$scale, $x+230*$scale, $y+218*$scale)
    $g.DrawLine($pen, $x+70*$scale, $y+218*$scale, $x+91*$scale, $y+218*$scale)
    Text $g "46m" ($x+150*$scale) ($y+236*$scale) (34*$scale) "#fff8fb" ([System.Drawing.FontStyle]::Bold) "Center"
    $track.Dispose()
    $pen.Dispose()
}

function Background($g) {
    $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#07100f"))
    FillRound $g 0 0 1920 960 0 "#07100f"
    $glow = Brush "#082a19"
    $g.FillEllipse($glow, 650, 240, 620, 620)
    $glow.Dispose()
}

New-Bitmap (Join-Path $OutputDir "thumbnail-1920x960.png") {
    param($g)
    Background $g
    Text $g "Codex Usage Monitor" 120 132 76 "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Usage windows on Stream Deck" 124 228 36 "#a7b0bd"
    DrawBarKey $g 1010 116 1.25 82 87 "green"
    DrawRingKey $g 1370 180 1.02 82 "green"
    DrawRingKey $g 1010 540 .9 38 "yellow"
    DrawWarningKey $g 1320 520 .95
}

New-Bitmap (Join-Path $OutputDir "gallery-dual-bars-green.png") {
    param($g)
    Background $g
    Text $g "Dual bars" 120 120 70 "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "5-hour and weekly usage together." 124 218 34 "#a7b0bd"
    DrawBarKey $g 1050 155 1.62 82 87 "green"
}

New-Bitmap (Join-Path $OutputDir "gallery-ring-warning.png") {
    param($g)
    Background $g
    Text $g "Ring gauge" 120 120 70 "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Single-window usage view." 124 218 34 "#a7b0bd"
    DrawRingKey $g 1080 165 1.58 38 "yellow"
}

New-Bitmap (Join-Path $OutputDir "gallery-oh-no-critical.png") {
    param($g)
    Background $g
    Text $g "Low-limit state" 120 120 70 "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Optional low-limit alerts." 124 218 34 "#a7b0bd"
    DrawWarningKey $g 1090 165 1.58
}

New-Bitmap (Join-Path $OutputDir "gallery-property-inspector.png") {
    param($g)
    Background $g
    Text $g "Property Inspector" 120 120 70 "#f6fff8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Modes, thresholds, refresh, mood." 124 218 34 "#a7b0bd"
    FillRound $g 970 105 700 750 28 "#1b1b1f"
    Text $g "DISPLAY" 1030 160 24 "#9ca8b8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Mode                 Dual bars" 1030 220 32 "#f4f6f8"
    Text $g "Single display        Auto" 1030 278 32 "#f4f6f8"
    Text $g "Percent basis         Remaining" 1030 336 32 "#f4f6f8"
    Text $g "Refresh interval      300 seconds" 1030 394 32 "#f4f6f8"
    Text $g "THRESHOLDS" 1030 478 24 "#9ca8b8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Yellow 50     Red 20     Critical 10" 1030 538 32 "#f4f6f8"
    Text $g "INDICATORS" 1030 622 24 "#9ca8b8" ([System.Drawing.FontStyle]::Bold)
    Text $g "Mood icons on     Pulse low state on" 1030 682 32 "#f4f6f8"
    Text $g "Privacy: uses local Codex auth; tokens are not logged." 1030 780 24 "#8e99a8"
}

Get-ChildItem -LiteralPath $OutputDir -Filter *.png | Select-Object FullName, Length
