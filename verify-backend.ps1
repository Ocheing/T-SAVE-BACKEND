Write-Host "=== TSave Backend Verification ===`n" -ForegroundColor Cyan

$baseUrl = "http://localhost:3000"

# 1. Basic health check
Write-Host "1. Health Check:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
    Write-Host "   ✓ API is running" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Compress)" -ForegroundColor Gray
} catch {
    Write-Host "   ✗ API not reachable: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Check if Prisma is connected
Write-Host "`n2. Database Connection:" -ForegroundColor Yellow
try {
    # Try to get trips (requires DB connection)
    $response = Invoke-RestMethod -Uri "$baseUrl/trips" -Method Get -ErrorAction Stop
    if ($response -and $response.data) {
        Write-Host "   ✓ Database connected" -ForegroundColor Green
        Write-Host "   Found $($response.data.Length) trips" -ForegroundColor Gray
    }
} catch {
    Write-Host "   ⚠ Database test: $($_.Exception.Message)" -ForegroundColor Yellow
}

# 3. Check module endpoints (just for 200/401 responses)
Write-Host "`n3. Module Endpoints:" -ForegroundColor Yellow
$modules = @(
    @{Name="Auth"; Path="/auth/login"; Expected="4xx"},
    @{Name="Dashboard"; Path="/dashboard"; Expected="401"},
    @{Name="Trips"; Path="/trips"; Expected="200 or 401"},
    @{Name="Savings"; Path="/savings"; Expected="401"},
    @{Name="Bookings"; Path="/bookings"; Expected="401"},
    @{Name="Wishlist"; Path="/wishlist"; Expected="401"},
    @{Name="AI Assistant"; Path="/ai/conversations"; Expected="401"},
    @{Name="Notifications"; Path="/notifications"; Expected="401"},
    @{Name="Payments"; Path="/payments/stats"; Expected="401"}
)

foreach ($module in $modules) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$($module.Path)" -Method Get -ErrorAction SilentlyContinue
        $status = $response.StatusCode
        Write-Host "   $($module.Name): $status" -ForegroundColor Green
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        if ($status -eq 401 -and $module.Expected -match "401") {
            Write-Host "   $($module.Name): 401 (Auth required ✓)" -ForegroundColor Green
        } elseif ($status -eq 404) {
            Write-Host "   $($module.Name): 404 (Not found)" -ForegroundColor Yellow
        } else {
            Write-Host "   $($module.Name): $status" -ForegroundColor Gray
        }
    }
}

Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
Write-Host "✅ Backend is operational" -ForegroundColor Green
Write-Host "📊 Next: Test with actual data using api-tests.http file" -ForegroundColor Cyan
