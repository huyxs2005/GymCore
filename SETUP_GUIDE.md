# Hướng Dẫn Kết Nối MSSQL và Chạy GymCore

## ✅ Đã Hoàn Thành

Tôi đã cập nhật cấu hình kết nối MSSQL cho bạn:

### 1. File `application.properties`
- ✅ Database: `GymCore`
- ✅ Username: `sa`
- ✅ Password: `123` (đã cập nhật từ `1` → `123`)
- ✅ MSSQL JDBC Driver đã được cấu hình

### 2. File `pom.xml`
- ✅ Java version: sửa từ `25` → `21` (vì Java 25 chưa có)
- ✅ MSSQL JDBC dependency đã có sẵn

---

## 🔧 Các Bước Tiếp Theo

### Bước 1: Reload Maven Project (QUAN TRỌNG!)

**Trong VS Code:**
1. Mở Command Palette: `Ctrl + Shift + P`
2. Gõ: `Java: Clean Java Language Server Workspace`
3. Chọn `Restart and delete` khi được hỏi
4. Hoặc đơn giản: **Đóng và mở lại VS Code**

**Hoặc trong IntelliJ IDEA:**
1. Nhấp chuột phải vào file `pom.xml`
2. Chọn `Maven → Reload project`

### Bước 2: Tạo Database GymCore (nếu chưa có)

Mở **SQL Server Management Studio (SSMS)** hoặc **Azure Data Studio**:

```sql
-- Kết nối với MSSQL Server (localhost, sa, 123)
-- Chạy script tạo database:

-- Nếu database chưa có, tạo mới:
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'GymCore')
BEGIN
    CREATE DATABASE GymCore;
    PRINT 'Database GymCore created successfully!';
END
ELSE
BEGIN
    PRINT 'Database GymCore already exists.';
END
GO

USE GymCore;
GO
```

### Bước 3: Chạy Script Tạo Tables

**Chạy file:** `docs\GymCore.txt`

Trong SSMS:
1. File → Open → File
2. Chọn: `d:\Semester5\SWP391\SWPProject\GymCore\docs\GymCore.txt`
3. Execute (F5)

Hoặc tạo mới database từ đầu:

```powershell
# Trong PowerShell tại thư mục GymCore
sqlcmd -S localhost -U sa -P 123 -i "docs\GymCore.txt"
```

### Bước 4: Insert Dữ Liệu Mẫu

**Option 1 - Insert tất cả (Users + Products):**
```powershell
sqlcmd -S localhost -U sa -P 123 -d GymCore -i "docs\InsertValues.txt"
```

**Option 2 - Chỉ insert 20 Products:**
```powershell
sqlcmd -S localhost -U sa -P 123 -d GymCore -i "backend\docs\Insert_Sample_Products.sql"
```

Hoặc chạy trực tiếp trong SSMS:
1. Kết nối đến database `GymCore`
2. Mở file `Insert_Sample_Products.sql`
3. Execute (F5)

### Bước 5: Kiểm Tra Database

```sql
USE GymCore;
GO

-- Kiểm tra có bao nhiêu products
SELECT COUNT(*) AS TotalProducts FROM dbo.Products;

-- Xem danh sách products
SELECT 
    ProductID,
    ProductName,
    Price,
    IsActive,
    CreatedAt
FROM dbo.Products
ORDER BY CreatedAt DESC;
```

### Bước 6: Khởi Động Backend Server

**Trong PowerShell:**

```powershell
cd backend
./mvnw clean install
./mvnw spring-boot:run
```

Hoặc nếu dùng Maven wrapper trên Windows:

```powershell
cd backend
mvnw.cmd clean install
mvnw.cmd spring-boot:run
```

Chờ cho đến khi thấy log:
```
Started BackendApplication in X.XXX seconds
```

### Bước 7: Khởi Động Frontend

**Mở terminal mới:**

```powershell
cd frontend
npm install  # Chỉ cần chạy lần đầu
npm run dev
```

Truy cập: http://localhost:5173

### Bước 8: Đăng Nhập và Kiểm Tra

**Tài khoản Admin:**
- Email: `admin@gymcore.local`
- Password: `Admin123456!`

**Tài khoản Customer:**
- Email: `customer@gymcore.local`
- Password: `Customer123456!`

---

## 🐛 Troubleshooting

### Lỗi: "Cannot connect to database"

**Kiểm tra MSSQL Server có chạy không:**

```powershell
# Windows Services
services.msc
# Tìm: SQL Server (MSSQLSERVER)
# Phải có status: Running
```

**Test kết nối:**

```powershell
sqlcmd -S localhost -U sa -P 123
# Nếu kết nối được, gõ: SELECT @@VERSION
# GO
```

### Lỗi: "Java version 25 not found"

➡️ Đã fix rồi! Reload Maven project (Bước 1)

### Lỗi: Backend không start được

```powershell
# Xóa cache Maven và rebuild
cd backend
./mvnw clean
./mvnw install
```

### Admin Products Page trống

1. ✅ Kiểm tra database có products: `SELECT * FROM Products`
2. ✅ Kiểm tra backend có chạy: http://localhost:8080
3. ✅ Check API trong browser DevTools (F12):
   - Tab Network
   - Tìm request: `GET /api/v1/admin/products`
   - Xem response có data không

---

## 📝 Tóm Tắt Nhanh

```powershell
# 1. Tạo database và tables
sqlcmd -S localhost -U sa -P 123 -i "docs\GymCore.txt"

# 2. Insert dữ liệu mẫu
sqlcmd -S localhost -U sa -P 123 -d GymCore -i "docs\InsertValues.txt"

# 3. Start backend (terminal 1)
cd backend
./mvnw spring-boot:run

# 4. Start frontend (terminal 2)
cd frontend
npm run dev

# 5. Mở browser
# http://localhost:5173
# Login: admin@gymcore.local / Admin123456!
```

---

## 🎯 Kết Quả Mong Đợi

Sau khi hoàn thành tất cả các bước:

✅ Backend chạy ở: http://localhost:8080  
✅ Frontend chạy ở: http://localhost:5173  
✅ Database GymCore có 20 sản phẩm mẫu  
✅ Admin có thể xem/thêm/sửa products  
✅ Customer có thể mua sản phẩm, review, checkout với PayOS

Good luck! 🚀
