# Screenshot Monitoring System

This is a **Screen Monitoring System** built using **.NET with EF Core** and **PostgreSQL/MySQL** as the database. The system consists of:

- A **desktop application** for employees that runs in the background, capturing screenshots at random intervals and tracking active/online time.
- A **web portal** for the admin to view users' screens live, track work hours, and manage employees and projects.

## Connect to Postgres DB
To connect to database create appsettings.Development.json.
Then add the Postgres Connection string to it.

```shell
cd ScreenshotMonitor.API/ 
```

```shell
cp appsettings.json appsettings.Development.json
```
Make a copy of appsettings.json

```json
{
  "ConnectionStrings": {
    "SmDb": "CONNECTION STRING HERE" 
  }
}
```
```json
{
  "JWT": {
    "Key": "JWT KEY HERE"
  }
}
```
### Features

### **Admin Features**
- Register and log in using JWT authentication
- Create and manage multiple projects
- Assign employees to projects
- View employee work sessions and total work hours
- Live screen viewing of employees using WebRTC
- Track active/idle time and running applications

### **Employee Features**
- Log in and start session tracking
- Background app that runs continuously
- Captures screenshots at random intervals
- Tracks time spent on projects
- Monitors running foreground and background applications

## **Tech Stack**
- **Backend**: .NET with EF Core
- **Database**: PostgreSQL/MySQL
- **Frontend**: Web portal for admins (ASP.NET or ReactJS)
- **Desktop App**: .NET-based background service
- **Authentication**: JWT with HTTPS cookies
- **Real-time Tracking**: WebRTC for online status
- **File Storage**: Local storage for screenshots

---

## **Installation & Setup**

### **1. Clone the Repository**
```sh
git clone https://github.com/yourusername/ScreenshotMonitor.git
cd ScreenshotMonitor
```

### **2. Setup PostgreSQL/MySQL Database**
Ensure PostgreSQL or MySQL is installed and running. Create a database manually or let EF Core handle it.

#### **PostgreSQL Connection Example**
```json
"ConnectionStrings": {
  "DefaultConnection": "Host=localhost;Port=5432;Database=newDb;Username=postgres;Password=your_password;"
}
```

#### **MySQL Connection Example**
```json
"ConnectionStrings": {
  "DefaultConnection": "Server=localhost;Database=newDb;User=root;Password=your_password;"
}
```

### **3. Configure Environment Variables**
Create an `.env` file or set environment variables manually:
```sh
ASPNETCORE_ENVIRONMENT=Development
JWT_SECRET=your_secret_key
```

### **4. Apply Database Migrations**
Run the following command to create tables using EF Core:
```sh
dotnet ef database update
```

### **5. Run the Application**
To start the API server:
```sh
dotnet run
```
The server should now be running on **`http://localhost:5000`** (or a different port if configured).

---

## **How to Use the System**

### **Admin Panel**
1. Open the web portal (`http://localhost:5000`)
2. Register/Login as an admin
3. Create and manage projects/employees
4. View real-time employee screens and work sessions

### **Employee Desktop App**
1. Install and run the desktop application
2. Login and keep it running in the background
3. It will automatically capture screenshots and track time

---

## **Contributing**
Pull requests are welcome! Please follow these steps:
1. Fork the repo
2. Create a new branch (`git checkout -b feature-branch`)
3. Commit your changes (`git commit -m "Added new feature"`)
4. Push to your branch (`git push origin feature-branch`)
5. Create a Pull Request

---

## **License**
This project is licensed under the MIT License.

---

### **Future Enhancements**
- Cloud storage for screenshots (AWS S3, Google Cloud Storage, etc.)
- AI-based productivity analysis
- Mobile support for admins

---

For any issues, feel free to raise an issue or contact me at ahsan.farooq531@gmail.com🚀

