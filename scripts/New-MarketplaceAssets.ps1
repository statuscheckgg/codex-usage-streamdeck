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

function TextBox($g, $text, $x, $y, $w, $h, $size, $color, $style = [System.Drawing.FontStyle]::Regular, $align = "Near") {
    $font = Font $size $style
    $brush = Brush $color
    $format = [System.Drawing.StringFormat]::new()
    $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
    if ($align -eq "Center") { $format.Alignment = [System.Drawing.StringAlignment]::Center }
    if ($align -eq "Far") { $format.Alignment = [System.Drawing.StringAlignment]::Far }
    $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
    $g.DrawString($text, $font, $brush, $rect, $format)
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

function GradientBackground($g, $left, $right) {
    $rect = [System.Drawing.Rectangle]::new(0, 0, 1920, 960)
    $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
        $rect,
        [System.Drawing.ColorTranslator]::FromHtml($left),
        [System.Drawing.ColorTranslator]::FromHtml($right),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal
    )
    $g.FillRectangle($brush, $rect)
    $brush.Dispose()
    $vignette = Brush "#000000"
    $state = $g.Save()
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $g.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(80, 0, 0, 0)), 0, 0, 1920, 960)
    $g.Restore($state)
    $vignette.Dispose()
}

function Detail($g, $label, $value, $x, $y) {
    Text $g $label $x $y 25 "#95a3b5" ([System.Drawing.FontStyle]::Bold)
    Text $g $value $x ($y+38) 34 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
}

function Pill($g, $text, $x, $y, $w, $color) {
    FillRound $g $x $y $w 50 25 $color
    Text $g $text ($x + ($w / 2)) ($y + 11) 24 "#07120d" ([System.Drawing.FontStyle]::Bold) "Center"
}

function DrawAppIcon($g, $x, $y, $size) {
    FillRound $g $x $y $size $size ($size*.22) "#111a25"
    $stroke = Pen "#2b3a4b" ($size*.055)
    $g.DrawPath($stroke, (RoundRectPath ($x+$size*.1) ($y+$size*.1) ($size*.8) ($size*.8) ($size*.17)))
    $stroke.Dispose()
    $green = Pen "#34e977" ($size*.08)
    $g.DrawLine($green, $x+$size*.28, $y+$size*.38, $x+$size*.72, $y+$size*.38)
    $g.DrawLine($green, $x+$size*.28, $y+$size*.64, $x+$size*.72, $y+$size*.64)
    $green.Dispose()
    Text $g "5H" ($x+$size*.5) ($y+$size*.22) ($size*.17) "#f7fbff" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "WK" ($x+$size*.5) ($y+$size*.48) ($size*.17) "#f7fbff" ([System.Drawing.FontStyle]::Bold) "Center"
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
    Text $g "CRITICAL" ($x+150*$scale) ($y+42*$scale) (30*$scale) "#ff335d" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "8%" ($x+150*$scale) ($y+103*$scale) (94*$scale) "#fff8fb" ([System.Drawing.FontStyle]::Bold) "Center"
    $track = Pen "#34303f" (18*$scale)
    $pen = Pen "#ff335d" (18*$scale)
    $g.DrawLine($track, $x+70*$scale, $y+218*$scale, $x+230*$scale, $y+218*$scale)
    $g.DrawLine($pen, $x+70*$scale, $y+218*$scale, $x+91*$scale, $y+218*$scale)
    Text $g "46m" ($x+150*$scale) ($y+236*$scale) (34*$scale) "#fff8fb" ([System.Drawing.FontStyle]::Bold) "Center"
    $track.Dispose()
    $pen.Dispose()
}

function DrawSplitKey($g, $x, $y, $scale, $five, $week) {
    FillRound $g $x $y (300*$scale) (300*$scale) (52*$scale) "#071312"
    FillRound $g ($x+22*$scale) ($y+22*$scale) (256*$scale) (116*$scale) (34*$scale) "#111a25"
    FillRound $g ($x+22*$scale) ($y+162*$scale) (256*$scale) (116*$scale) (34*$scale) "#111a25"
    Text $g "5H" ($x+58*$scale) ($y+51*$scale) (33*$scale) "#34e977" ([System.Drawing.FontStyle]::Bold)
    Text $g "$five%" ($x+58*$scale) ($y+90*$scale) (55*$scale) "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    Text $g "4h" ($x+244*$scale) ($y+97*$scale) (36*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold) "Far"
    Text $g "WK" ($x+58*$scale) ($y+191*$scale) (33*$scale) "#f6d84d" ([System.Drawing.FontStyle]::Bold)
    Text $g "$week%" ($x+58*$scale) ($y+230*$scale) (55*$scale) "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    Text $g "6d" ($x+244*$scale) ($y+237*$scale) (36*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold) "Far"
}

function DrawInspectorField($g, $label, $value, $x, $y, $scale, $kind = "select") {
    Text $g $label $x ($y+11*$scale) (17*$scale) "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    FillRound $g ($x+245*$scale) $y (342*$scale) (42*$scale) (6*$scale) "#090d13"
    $border = Pen "#354254" (1.2*$scale)
    $g.DrawPath($border, (RoundRectPath ($x+245*$scale) $y (342*$scale) (42*$scale) (6*$scale)))
    $border.Dispose()
    Text $g $value ($x+263*$scale) ($y+10*$scale) (16*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold)
    if ($kind -eq "select") {
        Text $g "v" ($x+565*$scale) ($y+8*$scale) (18*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold) "Center"
    }
}

function DrawInspector($g, $x, $y, $scale) {
    FillRound $g $x $y (820*$scale) (782*$scale) (10*$scale) "#2a2a2a"
    FillRound $g $x ($y+58*$scale) (170*$scale) (724*$scale) 0 "#2f2f2f"
    Text $g "Codex Usage Monitor:" ($x+16*$scale) ($y+15*$scale) (18*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold)
    Text $g "Codex Usage" ($x+210*$scale) ($y+15*$scale) (18*$scale) "#ffffff"
    Text $g "?" ($x+724*$scale) ($y+10*$scale) (26*$scale) "#9ca3af" ([System.Drawing.FontStyle]::Bold) "Center"
    Text $g "[]" ($x+786*$scale) ($y+12*$scale) (20*$scale) "#9ca3af" ([System.Drawing.FontStyle]::Bold) "Center"
    $rule = Pen "#464646" (1*$scale)
    $g.DrawLine($rule, $x+16*$scale, $y+58*$scale, $x+798*$scale, $y+58*$scale)
    $rule.Dispose()

    DrawBarKey $g ($x+18*$scale) ($y+86*$scale) (.37*$scale) 7 46 "yellow"

    Text $g "Title:" ($x+252*$scale) ($y+94*$scale) (17*$scale) "#cfd3dc" "Regular" "Far"
    FillRound $g ($x+270*$scale) ($y+82*$scale) (392*$scale) (42*$scale) 0 "#2d2d2d"
    Text $g "Disabled" ($x+292*$scale) ($y+94*$scale) (17*$scale) "#9aa3ad"
    Text $g "T" ($x+686*$scale) ($y+89*$scale) (24*$scale) "#a9a9a9" ([System.Drawing.FontStyle]::Bold)
    Text $g "v" ($x+724*$scale) ($y+91*$scale) (16*$scale) "#a9a9a9" ([System.Drawing.FontStyle]::Bold)

    $mainX = $x + 210*$scale
    FillRound $g $mainX ($y+162*$scale) (588*$scale) (130*$scale) (10*$scale) "#111821"
    $noteBorder = Pen "#32465c" (1.4*$scale)
    $g.DrawPath($noteBorder, (RoundRectPath $mainX ($y+162*$scale) (588*$scale) (130*$scale) (10*$scale)))
    $noteBorder.Dispose()
    TextBox $g "This unofficial monitor reads your local Codex auth file and requests usage from ChatGPT. Nothing is logged by the plugin. Usage checks do not consume Codex usage tokens." ($mainX+18*$scale) ($y+184*$scale) (548*$scale) (88*$scale) (19*$scale) "#d8f3ff"

    Text $g "DISPLAY" $mainX ($y+325*$scale) (20*$scale) "#9fc2e6" ([System.Drawing.FontStyle]::Bold)
    DrawInspectorField $g "Mode" "Dual bars" $mainX ($y+366*$scale) $scale "select"
    DrawInspectorField $g "Percent" "Remaining" $mainX ($y+420*$scale) $scale "select"
    DrawInspectorField $g "Single icon shows" "Auto - lowest remaining" $mainX ($y+474*$scale) $scale "select"
    DrawInspectorField $g "Refresh seconds" "300" $mainX ($y+528*$scale) $scale "input"
    Text $g "Show reset time" $mainX ($y+594*$scale) (17*$scale) "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    FillRound $g ($mainX+245*$scale) ($y+588*$scale) (26*$scale) (26*$scale) (3*$scale) "#d8e8fb"
    Text $g "/" ($mainX+258*$scale) ($y+583*$scale) (35*$scale) "#2f6f9e" ([System.Drawing.FontStyle]::Bold) "Center"

    Text $g "THRESHOLDS" $mainX ($y+650*$scale) (20*$scale) "#9fc2e6" ([System.Drawing.FontStyle]::Bold)
    $fieldW = 174*$scale
    $gap = 14*$scale
    $startY = $y + 688*$scale
    $labels = @("Yellow at", "Red at", "Critical at")
    $values = @("50", "20", "10")
    for ($i=0; $i -lt 3; $i++) {
        $fx = $mainX + ($i * ($fieldW + $gap))
        Text $g $labels[$i] $fx $startY (15*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold)
        FillRound $g $fx ($startY+28*$scale) $fieldW (40*$scale) (6*$scale) "#090d13"
        $inputBorder = Pen "#354254" (1.2*$scale)
        $g.DrawPath($inputBorder, (RoundRectPath $fx ($startY+28*$scale) $fieldW (40*$scale) (6*$scale)))
        $inputBorder.Dispose()
        Text $g $values[$i] ($fx+16*$scale) ($startY+39*$scale) (16*$scale) "#ffffff" ([System.Drawing.FontStyle]::Bold)
    }
}

New-Bitmap (Join-Path $OutputDir "thumbnail-1920x960.png") {
    param($g)
    GradientBackground $g "#061412" "#13273f"
    DrawAppIcon $g 118 112 160
    Text $g "Codex Usage Monitor" 118 330 82 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    TextBox $g "Track Codex usage on Stream Deck." 122 430 780 70 38 "#b8c4d4"
    Pill $g "FREE" 122 510 118 "#34e977"
    Pill $g "LOCAL AUTH" 262 510 210 "#9ee7ff"
    Detail $g "5-hour window" "82% remaining" 122 620
    Detail $g "Weekly window" "87% remaining" 122 735
    DrawBarKey $g 1030 130 1.34 82 87 "green"
    DrawSplitKey $g 1392 290 .82 82 87
    DrawWarningKey $g 1086 610 .72
    DrawRingKey $g 1390 585 .76 38 "yellow"
}

New-Bitmap (Join-Path $OutputDir "gallery-dual-bars-green.png") {
    param($g)
    GradientBackground $g "#061412" "#1f3140"
    Text $g "See both limits at a glance" 120 120 70 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    TextBox $g "Dual bars keep the 5-hour and weekly windows visible on one key." 124 216 760 95 34 "#b8c4d4"
    Detail $g "5H" "82% remaining, resets in 4h" 124 355
    Detail $g "WK" "87% remaining, resets in 6d" 124 485
    Pill $g "Updates automatically" 124 650 300 "#34e977"
    DrawBarKey $g 1070 155 1.62 82 87 "green"
}

New-Bitmap (Join-Path $OutputDir "gallery-ring-warning.png") {
    param($g)
    GradientBackground $g "#0b1018" "#343014"
    Text $g "Single-window views" 120 120 70 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    TextBox $g "Show Auto, 5H, Weekly, or Spark in ring and warning modes." 124 216 830 95 34 "#cbd3df"
    Detail $g "Selected view" "5-hour remaining" 124 360
    Detail $g "Threshold color" "Yellow at 50%" 124 490
    Pill $g "Spark limit supported" 124 654 292 "#f6d84d"
    DrawRingKey $g 1190 150 1.48 38 "yellow"
}

New-Bitmap (Join-Path $OutputDir "gallery-critical-state.png") {
    param($g)
    GradientBackground $g "#100b14" "#3b1322"
    Text $g "Critical state is clear" 120 120 70 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    TextBox $g "Professional warning labels with optional visual flicker." 124 216 760 95 34 "#d8c6d3"
    Detail $g "Critical threshold" "10% remaining" 124 360
    Detail $g "Visual flicker" "Configurable per level" 124 490
    Pill $g "No extra usage checks" 124 654 292 "#ff9db3"
    DrawWarningKey $g 1100 150 1.58
}

New-Bitmap (Join-Path $OutputDir "gallery-property-inspector.png") {
    param($g)
    GradientBackground $g "#0b1018" "#183833"
    Text $g "Tune the key behavior" 120 120 70 "#f7fbff" ([System.Drawing.FontStyle]::Bold)
    TextBox $g "Configure modes, thresholds, Spark, reset labels, and flicker cadence." 124 216 780 100 34 "#b8c4d4"
    Detail $g "Privacy note" "Nothing is logged by the plugin" 124 360
    Detail $g "Usage checks" "Do not consume Codex usage tokens" 124 490
    Pill $g "Property Inspector" 124 654 300 "#34e977"
    DrawInspector $g 885 98 .92
}

Get-ChildItem -LiteralPath $OutputDir -Filter *.png | Select-Object FullName, Length
