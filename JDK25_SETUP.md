# Hướng Dẫn Cài Đặt và Cấu Hình JDK 25

## Bước 1: Giải Nén JDK 25

Giả sử bạn đã tải JDK 25 vào thư mục Downloads (ví dụ: `jdk-25_windows-x64_bin.zip`):

1. Giải nén file JDK vào thư mục cố định, ví dụ:
   ```
   C:\Program Files\Java\jdk-25
   ```
   
   Hoặc:
   ```
   C:\Java\jdk-25
   ```

2. Sau khi giải nén, cấu trúc thư mục sẽ như sau:
   ```
   C:\Program Files\Java\jdk-25\
   ├── bin\
   │   ├── java.exe
   │   ├── javac.exe
   │   └── ...
   ├── lib\
   └── ...
   ```

## Bước 2: Cấu Hình Biến Môi Trường (Environment Variables)

### Cách 1: Qua GUI (Windows)

1. **Mở System Properties:**
   - Nhấn `Win + R`
   - Gõ: `sysdm.cpl`
   - Enter

2. **Mở Environment Variables:**
   - Chọn tab **Advanced**
   - Click **Environment Variables**

3. **Thêm JAVA_HOME:**
   - Trong phần **System variables** (không phải User variables)
   - Click **New**
   - Variable name: `JAVA_HOME`
   - Variable value: `C:\Program Files\Java\jdk-25` (đường dẫn thư mục JDK của bạn)
   - Click **OK**

4. **Cập nhật PATH:**
   - Tìm biến **Path** trong **System variables**
   - Click **Edit**
   - Click **New**
   - Thêm: `%JAVA_HOME%\bin`
   - Click **OK** → **OK** → **OK**

### Cách 2: Qua PowerShell (Admin)

```powershell
# Chạy PowerShell as Administrator
# Đặt JAVA_HOME (thay đường dẫn cho phù hợp)
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-25', 'Machine')

# Thêm vào PATH
$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
$newPath = $currentPath + ';%JAVA_HOME%\bin'
[System.Environment]::SetEnvironmentVariable('Path', $newPath, 'Machine')

# Hiển thị thông báo
Write-Host "✅ JAVA_HOME đã được cấu hình: C:\Program Files\Java\jdk-25"
Write-Host "⚠️  Vui lòng ĐÓNG và MỞ LẠI tất cả terminal/CMD/PowerShell để áp dụng!"
```

## Bước 3: Kiểm Tra Cài Đặt

**Đóng và mở lại PowerShell/CMD mới**, sau đó chạy:

```powershell
# Kiểm tra JAVA_HOME
echo $env:JAVA_HOME
# Kết quả: C:\Program Files\Java\jdk-25

# Kiểm tra Java version
java -version
# Kết quả: java version "25" ...

# Kiểm tra Java compiler
javac -version
# Kết quả: javac 25
```

## Bước 4: Cấu Hình VS Code (Nếu Dùng VS Code)

1. **Mở Settings (Ctrl + ,)**

2. **Tìm: `java.jdt.ls.java.home`**

3. **Thêm vào `settings.json`:**
   ```json
   {
     "java.jdt.ls.java.home": "C:\\Program Files\\Java\\jdk-25",
     "java.configuration.runtimes": [
       {
         "name": "JavaSE-25",
         "path": "C:\\Program Files\\Java\\jdk-25",
         "default": true
       }
     ]
   }
   ```

4. **Reload VS Code:**
   - `Ctrl + Shift + P`
   - Gõ: `Java: Clean Java Language Server Workspace`
   - Chọn **Restart and delete**

## Bước 5: Cấu Hình IntelliJ IDEA (Nếu Dùng IntelliJ)

1. **File → Project Structure** (Ctrl + Alt + Shift + S)

2. **Platform Settings → SDKs**
   - Click **+** → **Add JDK**
   - Chọn thư mục: `C:\Program Files\Java\jdk-25`
   - Click **OK**

3. **Project Settings → Project**
   - **Project SDK:** Chọn **25**
   - **Language level:** Chọn **25 (Preview)**
   - Click **OK**

4. **Reload Maven Project:**
   - Nhấp chuột phải vào `pom.xml`
   - Chọn **Maven → Reload Project**

## Bước 6: Build và Run Backend

```powershell
# Đảm bảo bạn đang ở thư mục GymCore
cd d:\Semester5\SWP391\SWPProject\GymCore

# Clean và build lại project
cd backend
./mvnw clean install

# Nếu thành công, chạy server
./mvnw spring-boot:run
```

---

## 🐛 Troubleshooting

### Lỗi: "Error: JAVA_HOME is not defined correctly"

**Giải pháp:**
1. Kiểm tra JAVA_HOME có đúng không:
   ```powershell
   echo $env:JAVA_HOME
   ```
2. Đảm bảo không có dấu `/` hoặc `\` ở cuối
3. Đóng và mở lại terminal

### Lỗi: "java: error: release version 25 not supported"

**Giải pháp:**
- Maven vẫn dùng JDK cũ
- Cấu hình JAVA_HOME trong Maven:

**Tạo file:** `backend\.mvn\jvm.config` (nếu chưa có)
```
-Djava.home=C:\Program Files\Java\jdk-25
```

Hoặc chạy với JAVA_HOME rõ ràng:
```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-25"
./mvnw clean install
```

### Lỗi: VS Code vẫn báo lỗi Java version

**Giải pháp:**
1. Xóa folder `.vscode` trong project
2. `Ctrl + Shift + P` → `Java: Clean Java Language Server Workspace`
3. Restart VS Code

---

## 📝 Tóm Tắt Nhanh

```powershell
# 1. Giải nén JDK 25 vào: C:\Program Files\Java\jdk-25

# 2. Set JAVA_HOME (PowerShell Admin)
[System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-25', 'Machine')

# 3. ĐÓNG và MỞ LẠI PowerShell

# 4. Kiểm tra
java -version

# 5. Build project
cd backend
./mvnw clean install
./mvnw spring-boot:run
```

✅ Sau khi hoàn thành, backend sẽ chạy với JDK 25!

---

## ⚠️ Lưu Ý Quan Trọng

- **Spring Boot 4.0.2** hỗ trợ JDK 25 (preview features)
- Đảm bảo **JAVA_HOME** trỏ đúng đến JDK 25
- **Đóng tất cả terminal/IDE** sau khi set environment variables
- Nếu gặp vấn đề, thử dùng JDK 21 (LTS version) thay vì JDK 25
