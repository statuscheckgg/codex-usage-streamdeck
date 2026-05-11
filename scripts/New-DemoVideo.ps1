param(
    [string] $Output = (Join-Path $PSScriptRoot "..\marketplace-assets\codex-usage-monitor-demo.mp4"),
    [string] $FramesDir = (Join-Path $env:TEMP "codex-usage-monitor-demo-frames"),
    [int] $Fps = 24
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$Width = 1280
$Height = 720
$script:FrameIndex = 0

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
    [System.Drawing.Font]::new("Arial", [single]$size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Text($g, $text, $x, $y, $size, $color, $style = [System.Drawing.FontStyle]::Regular, $align = "Near") {
    $font = Font $size $style
    $brush = Brush $color
    $format = [System.Drawing.StringFormat]::new()
    if ($align -eq "Center") { $format.Alignment = [System.Drawing.StringAlignment]::Center }
    if ($align -eq "Far") { $format.Alignment = [System.Drawing.StringAlignment]::Far }
    $g.DrawString($text, $font, $brush, [System.Drawing.PointF]::new($x, $y), $format)
    $format.Dispose()
    $brush.Dispose()
    $font.Dispose()
}

function TextBox($g, $text, $x, $y, $w, $h, $size, $color, $style = [System.Drawing.FontStyle]::Regular) {
    $font = Font $size $style
    $brush = Brush $color
    $format = [System.Drawing.StringFormat]::new()
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    $g.DrawString($text, $font, $brush, [System.Drawing.RectangleF]::new($x, $y, $w, $h), $format)
    $format.Dispose()
    $brush.Dispose()
    $font.Dispose()
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
    $path.Dispose()
    $brush.Dispose()
}

function StrokeRound($g, $x, $y, $w, $h, $r, $color, $width) {
    $path = RoundRectPath $x $y $w $h $r
    $pen = Pen $color $width
    $g.DrawPath($pen, $path)
    $pen.Dispose()
    $path.Dispose()
}

function GradientBackground($g) {
    $rect = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $rect,
        [System.Drawing.ColorTranslator]::FromHtml("#061412"),
        [System.Drawing.ColorTranslator]::FromHtml("#13233a"),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    $shade = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(76, 0, 0, 0))
    $g.FillRectangle($shade, 0, 0, $Width, $Height)
    $shade.Dispose()
}

function Palette($level) {
    if ($level -eq "critical") {
        return @{ bg="#15121d"; panel="#1d1421"; accent="#ff335d"; text="#fff8fb"; muted="#a99aa9"; track="#34303f"; flash="#3b1630" }
    }
    if ($level -eq "red") {
        return @{ bg="#15121d"; panel="#1b1624"; accent="#ffb020"; text="#fffaf1"; muted="#aea0a4"; track="#34303f"; flash="#3a2416" }
    }
    if ($level -eq "yellow") {
        return @{ bg="#14151c"; panel="#181b25"; accent="#f6d84d"; text="#fffbe5"; muted="#a9a692"; track="#333640"; flash="#3c3518" }
    }
    return @{ bg="#071312"; panel="#111a25"; accent="#34e977"; text="#f6fff8"; muted="#9ba9a9"; track="#263241"; flash="#16352d" }
}

function LevelFor($value) {
    if ($value -le 10) { return "critical" }
    if ($value -le 20) { return "red" }
    if ($value -le 50) { return "yellow" }
    return "green"
}

function DrawKeyShell($g, $x, $y, $size, $level, $flickerOn = $false) {
    $p = Palette $level
    $s = $size / 144
    FillRound $g $x $y $size $size (28*$s) $p.bg
    $panel = if ($flickerOn) { $p.flash } else { $p.panel }
    FillRound $g ($x+10*$s) ($y+10*$s) (124*$s) (124*$s) (23*$s) $panel
    return $p
}

function DrawDualBarsKey($g, $x, $y, $size, $five, $week, $flickerOn = $false) {
    $level = LevelFor ([Math]::Min($five, $week))
    $p = DrawKeyShell $g $x $y $size $level $flickerOn
    $s = $size / 144
    $p5 = Palette (LevelFor $five)
    $pw = Palette (LevelFor $week)
    Text $g "$five%" ($x+23*$s) ($y+21*$s) (26*$s) $p.text ([System.Drawing.FontStyle]::Bold)
    Text $g "5H" ($x+110*$s) ($y+17*$s) (17*$s) $p5.accent ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "4h" ($x+110*$s) ($y+37*$s) (15*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    $track = Pen $p.track (6*$s)
    $pen = Pen $p5.accent (6*$s)
    $g.DrawLine($track, $x+24*$s, $y+65*$s, $x+107*$s, $y+65*$s)
    $g.DrawLine($pen, $x+24*$s, $y+65*$s, $x+(24+[Math]::Max(4, $five*.83))*$s, $y+65*$s)
    $pen.Dispose()
    Text $g "$week%" ($x+23*$s) ($y+79*$s) (26*$s) $p.text ([System.Drawing.FontStyle]::Bold)
    Text $g "WK" ($x+110*$s) ($y+75*$s) (17*$s) $pw.accent ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "6d" ($x+110*$s) ($y+95*$s) (15*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    $pen = Pen $pw.accent (6*$s)
    $g.DrawLine($track, $x+24*$s, $y+123*$s, $x+107*$s, $y+123*$s)
    $g.DrawLine($pen, $x+24*$s, $y+123*$s, $x+(24+[Math]::Max(4, $week*.83))*$s, $y+123*$s)
    $pen.Dispose()
    $track.Dispose()
}

function DrawRingKey($g, $x, $y, $size, $value, $label, $reset, $flickerOn = $false) {
    $level = LevelFor $value
    $p = DrawKeyShell $g $x $y $size $level $flickerOn
    $s = $size / 144
    $track = Pen $p.track (10*$s)
    $pen = Pen $p.accent (10*$s)
    $rect = [System.Drawing.RectangleF]::new($x+29*$s, $y+25*$s, 86*$s, 86*$s)
    $g.DrawArc($track, $rect, 130, 280)
    $g.DrawArc($pen, $rect, 130, 280*($value/100))
    Text $g "$value%" ($x+72*$s) ($y+50*$s) (28*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g $label ($x+72*$s) ($y+73*$s) (14*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g $reset ($x+72*$s) ($y+101*$s) (15*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    $pen.Dispose()
    $track.Dispose()
}

function DrawWarningKey($g, $x, $y, $size, $value, $label, $reset, $flickerOn = $false) {
    $level = LevelFor $value
    $p = DrawKeyShell $g $x $y $size $level $flickerOn
    $s = $size / 144
    Text $g $label ($x+72*$s) ($y+24*$s) (18*$s) $p.accent ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "$value%" ($x+72*$s) ($y+49*$s) (47*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    $track = Pen $p.track (9*$s)
    $pen = Pen $p.accent (9*$s)
    $g.DrawLine($track, $x+38*$s, $y+104*$s, $x+106*$s, $y+104*$s)
    $g.DrawLine($pen, $x+38*$s, $y+104*$s, $x+(38+[Math]::Max(5, $value*.68))*$s, $y+104*$s)
    Text $g $reset ($x+72*$s) ($y+113*$s) (16*$s) $p.text ([System.Drawing.FontStyle]::Bold) "Center"
    $pen.Dispose()
    $track.Dispose()
}

function DrawSplitKey($g, $x, $y, $size, $five, $week, $flickerOn = $false) {
    $level = LevelFor ([Math]::Min($five, $week))
    $p = Palette $level
    $s = $size / 144
    $panel = if ($flickerOn) { $p.flash } else { $p.panel }
    FillRound $g $x $y $size $size (28*$s) $p.bg
    FillRound $g ($x+10*$s) ($y+10*$s) (124*$s) (59*$s) (21*$s) $panel
    FillRound $g ($x+10*$s) ($y+75*$s) (124*$s) (59*$s) (21*$s) $panel
    Text $g "5H" ($x+24*$s) ($y+21*$s) (16*$s) (Palette (LevelFor $five)).accent ([System.Drawing.FontStyle]::Bold)
    Text $g "$five%" ($x+24*$s) ($y+37*$s) (28*$s) $p.text ([System.Drawing.FontStyle]::Bold)
    Text $g "4h" ($x+122*$s) ($y+38*$s) (18*$s) "#ffffff" ([System.Drawing.FontStyle]::Bold) "Far"
    Text $g "WK" ($x+24*$s) ($y+86*$s) (16*$s) (Palette (LevelFor $week)).accent ([System.Drawing.FontStyle]::Bold)
    Text $g "$week%" ($x+24*$s) ($y+102*$s) (28*$s) $p.text ([System.Drawing.FontStyle]::Bold)
    Text $g "6d" ($x+122*$s) ($y+103*$s) (18*$s) "#ffffff" ([System.Drawing.FontStyle]::Bold) "Far"
}

function DrawSettingsField($g, $label, $value, $x, $y, $w, $highlight = $false, $select = $true) {
    if ($highlight) {
        FillRound $g ($x-12) ($y-8) ($w+24) 48 10 "#20352f"
        StrokeRound $g ($x-12) ($y-8) ($w+24) 48 10 "#34e977" 2
    }
    Text $g $label $x ($y+7) 15 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    FillRound $g ($x+158) $y 230 34 6 "#090d13"
    StrokeRound $g ($x+158) $y 230 34 6 "#354254" 1
    Text $g $value ($x+172) ($y+8) 14 "#ffffff" ([System.Drawing.FontStyle]::Bold)
    if ($select) { Text $g "v" ($x+372) ($y+7) 14 "#ffffff" ([System.Drawing.FontStyle]::Bold) "Center" }
}

function DrawSettingsPanel($g, $mode, $single, $flicker, $highlight) {
    $x = 54
    $y = 112
    FillRound $g $x $y 500 548 10 "#2a2a2a"
    FillRound $g $x ($y+48) 110 500 0 "#303030"
    Text $g "Codex Usage Monitor:" ($x+14) ($y+15) 14 "#ffffff" ([System.Drawing.FontStyle]::Bold)
    Text $g "Codex Usage" ($x+166) ($y+15) 14 "#ffffff"
    $line = Pen "#464646" 1
    $g.DrawLine($line, $x+14, $y+48, $x+486, $y+48)
    $line.Dispose()
    DrawDualBarsKey $g ($x+20) ($y+78) 78 7 46
    Text $g "Title:" ($x+168) ($y+78) 13 "#cfd3dc" "Regular" "Far"
    FillRound $g ($x+180) ($y+68) 250 31 0 "#2d2d2d"
    Text $g "Disabled" ($x+196) ($y+78) 13 "#9aa3ad"
    FillRound $g ($x+150) ($y+122) 326 88 8 "#111821"
    StrokeRound $g ($x+150) ($y+122) 326 88 8 "#32465c" 1
    TextBox $g "This monitor reads your local Codex auth file and requests usage from ChatGPT. Nothing is logged by the plugin. Usage checks do not consume Codex usage tokens." ($x+162) ($y+136) 302 60 13 "#d8f3ff"
    Text $g "DISPLAY" ($x+150) ($y+232) 16 "#9fc2e6" ([System.Drawing.FontStyle]::Bold)
    DrawSettingsField $g "Mode" $mode ($x+150) ($y+270) 388 ($highlight -eq "mode")
    DrawSettingsField $g "Percent" "Remaining" ($x+150) ($y+314) 388 $false
    DrawSettingsField $g "Single icon shows" $single ($x+150) ($y+358) 388 ($highlight -eq "single")
    DrawSettingsField $g "Refresh seconds" "300" ($x+150) ($y+402) 388 $false $false
    Text $g "Show reset time" ($x+150) ($y+458) 15 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    FillRound $g ($x+308) ($y+454) 22 22 3 "#d8e8fb"
    Text $g "/" ($x+319) ($y+449) 28 "#2f6f9e" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "VISUAL FLICKER" ($x+150) ($y+503) 16 "#9fc2e6" ([System.Drawing.FontStyle]::Bold)
    $flickerText = if ($flicker) { "Critical 1s: On" } else { "Critical 1s: Off" }
    $flickerColor = if ($flicker) { "#34e977" } else { "#f7fbff" }
    Text $g $flickerText ($x+150) ($y+536) 20 $flickerColor ([System.Drawing.FontStyle]::Bold)
}

function DrawSlideText($g, $title, $subtitle, $modeName) {
    Text $g "Codex Usage Monitor" 54 32 34 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    Text $g $modeName 54 73 18 "#34e977" ([System.Drawing.FontStyle]::Bold)
    Text $g $title 606 116 40 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    TextBox $g $subtitle 608 168 585 92 22 "#c8d2df"
    FillRound $g 606 584 520 52 26 "#11251f"
    Text $g "Nothing is logged. Usage checks do not consume Codex tokens." 866 599 17 "#d9f7e5" ([System.Drawing.FontStyle]::Bold) "Center"
}

function New-Frame($frameDraw) {
    $bmp = [System.Drawing.Bitmap]::new($Width, $Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    GradientBackground $g
    $frameDraw.Invoke($g)
    $path = Join-Path $FramesDir ("frame_{0:d5}.png" -f $script:FrameIndex)
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    $script:FrameIndex++
}

function Add-Scene($seconds, $draw) {
    $count = [int]($seconds * $Fps)
    $sceneDraw = $draw
    for ($i = 0; $i -lt $count; $i++) {
        $t = if ($count -le 1) { 1 } else { $i / ($count - 1) }
        New-Frame { param($g) $sceneDraw.Invoke($g, $t) }
    }
}

if (Test-Path -LiteralPath $FramesDir) {
    Remove-Item -LiteralPath $FramesDir -Recurse -Force
}
New-Item -ItemType Directory -Path $FramesDir -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $Output) -Force | Out-Null

Add-Scene 3 {
    param($g, $t)
    DrawSettingsPanel $g "Dual bars" "Auto - lowest remaining" $false "mode"
    DrawSlideText $g "Reviewer demo" "The action appears on a Stream Deck key and is configured from the Property Inspector. This video walks through each visual mode and the optional flicker behavior." "Local Stream Deck plugin"
    DrawDualBarsKey $g 782 282 238 82 87
}

Add-Scene 5 {
    param($g, $t)
    DrawSettingsPanel $g "Dual bars" "Auto - lowest remaining" $false "mode"
    DrawSlideText $g "Dual bars mode" "Shows the 5-hour and weekly windows together with independent threshold colors, remaining percentages, and reset countdowns." "Mode: Dual bars"
    DrawDualBarsKey $g 782 282 238 82 87
}

Add-Scene 6 {
    param($g, $t)
    $labels = @("5H", "WK", "SP")
    $values = @(46, 83, 62)
    $resets = @("3h", "6d", "4h")
    $singleNames = @("5-hour", "Weekly", "Spark")
    $idx = [Math]::Min(2, [int]($t * 3))
    DrawSettingsPanel $g "Ring gauge" $singleNames[$idx] $false "single"
    DrawSlideText $g "Ring gauge mode" "Single-window modes can show Auto, 5H, WK, or Spark. The selector is visible in the Property Inspector." "Mode: Ring gauge"
    DrawRingKey $g 782 282 238 $values[$idx] $labels[$idx] $resets[$idx]
}

Add-Scene 5 {
    param($g, $t)
    DrawSettingsPanel $g "Warning tile" "5-hour" $false "mode"
    DrawSlideText $g "Warning tile mode" "Low remaining usage switches to a clear warning tile with the selected window label, percent remaining, and reset timer." "Mode: Warning tile"
    DrawWarningKey $g 782 282 238 18 "5H" "1h"
}

Add-Scene 5 {
    param($g, $t)
    DrawSettingsPanel $g "Split key" "Auto - lowest remaining" $false "mode"
    DrawSlideText $g "Split key mode" "The split layout gives each usage window its own row, with white reset time aligned on the right for quick scanning." "Mode: Split key"
    DrawSplitKey $g 782 282 238 46 83
}

Add-Scene 7 {
    param($g, $t)
    $on = (([int]($t * 14)) % 2) -eq 1
    DrawSettingsPanel $g "Warning tile" "5-hour" $true "single"
    DrawSlideText $g "Optional critical flicker" "When enabled, the key visually pulses at the configured threshold cadence. This example shows the critical state at a one-second interval." "Critical threshold behavior"
    DrawWarningKey $g 782 282 238 8 "CRITICAL" "46m" $on
    if ($on) {
        StrokeRound $g 768 268 266 266 38 "#ff335d" 6
    }
}

Add-Scene 3 {
    param($g, $t)
    DrawSettingsPanel $g "Dual bars" "Auto - lowest remaining" $false "mode"
    DrawSlideText $g "Ready for Marketplace review" "The demo covers local configuration, all display modes, single-window selection, threshold coloring, and the optional flicker setting." "Summary"
    DrawDualBarsKey $g 782 282 238 82 87
}

$ffmpeg = Get-Command ffmpeg.exe -ErrorAction Stop
& $ffmpeg.Source -y -framerate $Fps -i (Join-Path $FramesDir "frame_%05d.png") -c:v libx264 -pix_fmt yuv420p -movflags +faststart $Output | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "ffmpeg failed with exit code $LASTEXITCODE"
}

Get-Item -LiteralPath $Output | Select-Object FullName, Length, LastWriteTime
