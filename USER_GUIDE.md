# Hướng dẫn Khởi chạy Hệ thống KTHT E-commerce (User Guide)

Tài liệu này hướng dẫn chi tiết từng bước để cài đặt, chuẩn bị cơ sở dữ liệu và khởi chạy toàn bộ hệ thống KTHT E-commerce (Front-end, Back-end API và SQL Server) trên máy cục bộ (Localhost).

---

## 1. Yêu cầu môi trường (Prerequisites)

Trước khi bắt đầu, hãy đảm bảo máy tính đã cài đặt các công cụ sau:

| Thành phần | Phiên bản khuyến nghị | Kiểm tra trong Terminal |
| :--- | :--- | :--- |
| **Hệ điều hành** | Windows 10 / 11 | - |
| **.NET SDK** | .NET 10.0 (hoặc .NET 9.0+) | `dotnet --version` |
| **Node.js & npm** | Node.js v20.x trở lên, npm v10.x trở lên | `node -v` và `npm -v` |
| **SQL Server** | SQL Server 2019/2022 (Bản Developer hoặc Express) | Đang chạy dịch vụ `MSSQLSERVER` hoặc instance cục bộ |
| **Git** | Bản mới nhất | `git --version` |

> [!NOTE]
> Nếu lệnh `npm` bị chặn trong PowerShell bởi chính sách thực thi script (`ExecutionPolicy`), bạn có thể dùng lệnh `npm.cmd` thay thế hoặc cấu hình PATH:
> ```powershell
> $env:PATH = "C:\Program Files\nodejs;$env:PATH"
> ```

---

## 2. Chuẩn bị Cơ sở dữ liệu (Database Setup)

Khi chạy dự án trên bất kỳ máy tính nào, bước quan trọng nhất là **chọn đúng tên Server / Instance của SQL Server (Server ID)** trên máy đó.

### Bước 2.1. Cách xác định đúng Server ID / Instance Name của máy bạn

Mỗi máy tính cài SQL Server có thể có tên định danh khác nhau. Hãy chạy lệnh PowerShell sau để kiểm tra máy bạn đang dùng bản SQL Server nào:

```powershell
Get-Service -Name "MSSQL*" | Select-Object Name, DisplayName, Status
```

Dựa vào kết quả hiển thị ở cột `Name`:

| Tên Service hiển thị | Loại SQL Server trên máy | Giá trị Server ID cần dùng |
| :--- | :--- | :--- |
| `MSSQLSERVER` | SQL Server Developer / Enterprise / Standard | `localhost` (hoặc `.`) |
| `MSSQL$SQLEXPRESS` | SQL Server Express (rất phổ biến) | `localhost\SQLEXPRESS` (hoặc `.\SQLEXPRESS`) |
| `MSSQL$<TEN_KHAC>` | Instance đặt theo tên riêng | `localhost\<TEN_KHAC>` |
| *(Không ra kết quả)* | Dùng LocalDB (đi kèm Visual Studio) | `(localdb)\mssqllocaldb` |

> [!TIP]
> **Cách xem qua giao diện SSMS:** Mở phần mềm *SQL Server Management Studio (SSMS)*, nhìn vào ô **Server name** ở cửa sổ đăng nhập $\rightarrow$ đó chính là Server ID của máy bạn!

---

### Bước 2.2. Thiết lập chuỗi kết nối phù hợp với máy của bạn

Mở **PowerShell tại thư mục gốc của dự án** (thư mục bạn đã clone repo về máy) và chạy lệnh:

```powershell
# 1. Khai báo môi trường Development
$env:ASPNETCORE_ENVIRONMENT = "Development"

# 2. Khai báo chuỗi kết nối (Thay <SERVER_ID> bằng giá trị xác định ở Bước 2.1)
$env:ConnectionStrings__DefaultConnection = "Server=<SERVER_ID>;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
```

**Ví dụ thực tế cho từng trường hợp:**
- **Nếu máy bạn cài SQL Server thông thường (Developer):**
  ```powershell
  $env:ConnectionStrings__DefaultConnection = "Server=localhost;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
  ```
- **Nếu máy bạn cài SQL Server Express:**
  ```powershell
  $env:ConnectionStrings__DefaultConnection = "Server=localhost\SQLEXPRESS;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
  ```
- **Nếu máy bạn dùng tài khoản `sa` (SQL Server Authentication thay vì Windows Auth):**
  ```powershell
  $env:ConnectionStrings__DefaultConnection = "Server=localhost\SQLEXPRESS;Database=KTHT_Ecom_Dev;User Id=sa;Password=<MatKhauCuaBan>;TrustServerCertificate=True"
  ```

---

### Bước 2.3. Áp dụng Migration vào SQL Server
Chạy lệnh EF Core để tự động tạo cơ sở dữ liệu `KTHT_Ecom_Dev` và các bảng (`Categories`, `Brands`, `Products`, `ProductVariants`):

```powershell
dotnet ef database update --project backend/src/Ktht.Infrastructure --startup-project backend/src/Ktht.Api
```

---

### Bước 2.4. Nạp dữ liệu sản phẩm (Seed & Import)

Bạn có 2 lựa chọn nạp dữ liệu (cả hai lệnh đều có tính **idempotent**, an toàn khi chạy lại nhiều lần mà không bị nhân đôi dữ liệu):

#### Cách A: Import bộ dữ liệu 132 sản phẩm thực tế từ Pharmacity CSV (Khuyến nghị)
Lệnh này nạp 132 sản phẩm, 63 nhãn hàng, 10 danh mục từ file `pharmacity_products_2026-11-03.csv`:
```powershell
dotnet run --project backend/src/Ktht.Api -- --import-pharmacity
```

#### Cách B: Nạp dữ liệu demo cơ bản ban đầu
Lệnh này nạp 18 sản phẩm mẫu thuộc 4 danh mục:
```powershell
dotnet run --project backend/src/Ktht.Api -- --seed-demo
```

---

## 3. Cài đặt Thư viện Front-end

Tại thư mục gốc dự án, di chuyển vào thư mục `frontend` và cài đặt các package npm:

```powershell
cd frontend
npm ci
cd ..
```
*(Hoặc dùng `npm.cmd ci` nếu dùng PowerShell).*

---

## 4. Hướng dẫn Khởi chạy Hệ thống

Để hệ thống hoạt động đầy đủ tính năng, bạn cần mở **2 cửa sổ PowerShell riêng biệt** tại thư mục gốc của dự án trên máy của bạn:

### Cửa sổ 1: Chạy Back-end Web API (Port 5080)

```powershell
# Di chuyển vào thư mục gốc dự án (thay bằng đường dẫn trên máy của bạn nếu cần)
cd <duong-dan-den-thu-muc-du-an>

# Khai báo chuỗi kết nối DB (Dùng đúng Server ID của máy bạn, vd: localhost hoặc localhost\SQLEXPRESS)
$env:ConnectionStrings__DefaultConnection = "Server=localhost;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
$env:ASPNETCORE_ENVIRONMENT = "Development"

# Khởi chạy Back-end
dotnet run --project backend/src/Ktht.Api --urls http://localhost:5080
```
> *(Nếu máy bạn dùng SQL Server Express, hãy đổi `Server=localhost` thành `Server=localhost\SQLEXPRESS` trước khi chạy).*
>
> Khi màn hình hiển thị `Now listening on: http://localhost:5080`, Back-end đã sẵn sàng phục vụ các API đọc danh mục và sản phẩm.

---

### Cửa sổ 2: Chạy Front-end Website (Port 5173)

```powershell
# Di chuyển vào thư mục frontend
cd <duong-dan-den-thu-muc-du-an>\frontend

# Khởi chạy Front-end qua Vite
npm run dev -- --host 0.0.0.0 --port 5173
```
*(Nếu PowerShell báo lỗi `npm.ps1`, dùng: `npm.cmd run dev -- --host 0.0.0.0 --port 5173`).*

> Khi màn hình hiển thị `VITE v6.x.x ready in ... ms` với link `http://localhost:5173/`, Front-end đã sẵn sàng!

---

## 5. Truy cập Ứng dụng & Các màn hình chính

Sau khi cả 2 server đã chạy:

- **Nếu dùng chính máy tính đang chạy server:** Mở trình duyệt truy cập:
  - **Trang chủ (C01)**: [`http://localhost:5173/`](http://localhost:5173/)
  - **Danh sách sản phẩm (C02)**: [`http://localhost:5173/products`](http://localhost:5173/products)
  - **Chi tiết sản phẩm (C03)**: [`http://localhost:5173/products/:slug`](http://localhost:5173/products)
  - **Admin Shell**: [`http://localhost:5173/admin`](http://localhost:5173/admin)

- **Nếu muốn máy khác / điện thoại trong cùng mạng WiFi truy cập:**
  1. Mở PowerShell chạy lệnh `ipconfig` trên máy chủ để xem địa chỉ IP (tìm dòng `IPv4 Address`, ví dụ: `192.168.1.15`).
  2. Từ điện thoại hoặc máy khác kết nối cùng WiFi, mở trình duyệt vào: `http://<IP_MAY_CHU>:5173` (ví dụ: `http://192.168.1.15:5173`).
  *(Lưu ý: Không cần mở port router; nếu bị chặn hãy kiểm tra Windows Defender Firewall cho phép cổng 5173 & 5080).*

- **Nếu muốn chia sẻ qua Internet không giới hạn mạng:** Dùng **Cloudflare Tunnel** ở Mục 6 bên dưới.

---

## 6. Đưa Website Online bằng Cloudflare Tunnel (Miễn phí & Không cần mở Port)

Cloudflare Tunnel (Quick Tunnel) cho phép bạn tạo một đường link HTTPS công khai trên Internet trỏ về localhost để người khác (giảng viên, bạn bè, thiết bị di động) có thể truy cập website từ bất kỳ đâu.

### Bước 6.1. Cài đặt hoặc tải `cloudflared` (Chỉ cần làm 1 lần)

Bạn chọn **1 trong 2 cách** sau:

- **Cách 1 (Khuyên dùng - Cài tự động qua Windows Package Manager):**
  Mở PowerShell và chạy:
  ```powershell
  winget install --id Cloudflare.cloudflared
  ```
  *(⚠️ **Quan trọng:** Sau khi cài đặt xong, bạn phải **tắt cửa sổ PowerShell đi và mở một cửa sổ PowerShell mới** để Windows nạp lại biến môi trường PATH).*

- **Cách 2 (Tải trực tiếp file `.exe` bằng lệnh PowerShell — Không cần cài đặt):**
  Nếu máy tính bị giới hạn quyền cài đặt phần mềm, hãy chạy lệnh sau ngay tại thư mục dự án để tải file `cloudflared.exe`:
  ```powershell
  Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
  ```
  *(File `cloudflared.exe` sẽ được lưu trực tiếp vào thư mục gốc của dự án).*

---

### Bước 6.2. Khởi chạy Cloudflare Tunnel

Sau khi **Back-end** (Port 5080) và **Front-end** (Port 5173) đã chạy ở Cửa sổ 1 và 2, mở **Cửa sổ PowerShell thứ 3** và chạy:

```powershell
cloudflared tunnel --url http://localhost:5173
```
*(Nếu bạn tải file `.exe` đặt ở thư mục gốc, dùng: `.\cloudflared.exe tunnel --url http://localhost:5173`).*

---

### Bước 6.3. Lấy link công khai để truy cập

Khi lệnh khởi chạy thành công, terminal sẽ in ra các dòng log. Hãy tìm dòng có dạng:

```text
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
|  https://example-random-subdomain.trycloudflare.com                                        |
+--------------------------------------------------------------------------------------------+
```

👉 **Sao chép đường link `https://...trycloudflare.com` và mở trên điện thoại hoặc gửi cho người khác!**

> [!TIP]
> **Tại sao chỉ cần tunnel port 5173 mà Back-end vẫn hoạt động?**
> Front-end Vite của dự án đã được cấu hình sẵn tính năng Reverse Proxy (`/api` $\rightarrow$ `http://localhost:5080`) và mở `allowedHosts: true`. Do đó, mọi yêu cầu giao diện lẫn truy vấn dữ liệu sản phẩm từ CSDL SQL Server đều đi qua một link duy nhất này.

> [!WARNING]
> Luôn giữ cả 3 cửa sổ terminal (Back-end, Front-end và Cloudflare Tunnel) cùng hoạt động. Khi bạn đóng terminal hoặc nhấn `Ctrl + C`, link public sẽ tự động ngừng hoạt động.

---

## 7. Hướng dẫn Chạy Kiểm thử (Tests & Checks)

Dự án cung cấp bộ kiểm thử tự động toàn diện để xác minh tính ổn định:

### 1. Kiểm tra logic Back-end & Catalog Checks (16 checks)
```powershell
dotnet run --project backend/tests/Ktht.Catalog.Checks
```

### 2. Kiểm tra Front-end (Lint, TypeScript, Unit Tests, Build)
```powershell
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test -- --run
npm.cmd --prefix frontend run build
```

### 3. Kiểm thử tích hợp E2E API (yêu cầu BE đang chạy tại port 5080)
```powershell
node tests/e2e/catalog-api.mjs http://127.0.0.1:5080
```

---

## 8. Xử lý sự cố thường gặp (Troubleshooting)

### Lỗi 1: `A network-related or instance-specific error occurred while establishing a connection to SQL Server`
- **Nguyên nhân**: Back-end không tìm thấy SQL Server vì bạn đang để `Server=localhost` nhưng máy bạn lại cài bản `SQL Server Express` (tên instance là `localhost\SQLEXPRESS`) hoặc dịch vụ SQL Server chưa được bật.
- **Cách khắc phục**:
  1. Chạy lệnh kiểm tra service SQL Server:
     ```powershell
     Get-Service -Name "MSSQL*"
     ```
     Nếu cột `Status` là `Stopped`, hãy bật lên bằng lệnh: `Start-Service -Name "MSSQL*"` (với quyền Administrator).
  2. Nếu máy cài bản Express, hãy đổi chuỗi kết nối sang `localhost\SQLEXPRESS`:
     ```powershell
     $env:ConnectionStrings__DefaultConnection = "Server=localhost\SQLEXPRESS;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
     ```

### Lỗi 2: `cloudflared : The term 'cloudflared' is not recognized`
- **Nguyên nhân**: Máy tính chưa có file `cloudflared` hoặc bạn vừa chạy `winget install` nhưng chưa tắt PowerShell đi mở lại để nạp biến môi trường.
- **Cách khắc phục**:
  - **Cách A**: Nếu đã cài bằng winget, hãy đóng cửa sổ PowerShell hiện tại và mở cửa sổ mới.
  - **Cách B**: Hoặc tải trực tiếp file exe về thư mục dự án bằng lệnh:
    ```powershell
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile "cloudflared.exe"
    ```
    Rồi chạy bằng lệnh: `.\cloudflared.exe tunnel --url http://localhost:5173`.

### Lỗi 3: `SSL Provider: The certificate chain was issued by an authority that is not trusted`
- **Nguyên nhân**: SQL Server yêu cầu mã hóa kết nối nhưng máy tính chưa tin cậy chứng chỉ tự cấp (self-signed).
- **Cách khắc phục**: Luôn bổ sung tham số `TrustServerCertificate=True` trong chuỗi kết nối:
  ```powershell
  $env:ConnectionStrings__DefaultConnection = "Server=localhost;Database=KTHT_Ecom_Dev;Trusted_Connection=True;TrustServerCertificate=True"
  ```

### Lỗi 4: Lỗi khóa file DLL `MSB3026 / MSB3027: The file is locked by: Ktht.Api`
- **Nguyên nhân**: Tiến trình Back-end API cũ đang chạy ngầm và giữ file `.dll`.
- **Cách khắc phục**: Dừng tiến trình cũ trong PowerShell:
  ```powershell
  Stop-Process -Name Ktht.Api -Force
  ```

### Lỗi 5: Cổng 5080 hoặc 5173 bị chiếm dụng
- **Cách khắc phục**: Tìm và tắt tiến trình đang chiếm cổng:
  ```powershell
  # Tìm PID chiếm cổng 5080
  Get-NetTCPConnection -LocalPort 5080 | Select-Object OwningProcess
  # Dừng tiến trình theo PID tìm thấy
  Stop-Process -Id <PID> -Force
  ```

### Lỗi 6: PowerShell báo lỗi không thể chạy `npm.ps1` do `ExecutionPolicy`
- **Cách khắc phục**: Chạy lệnh bằng file batch Windows `.cmd`:
  ```powershell
  npm.cmd run dev -- --host localhost --port 5173
  ```
