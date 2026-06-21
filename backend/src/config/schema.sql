-- Employee Attendance Management System Database Schema
-- Run this file to initialize the database

CREATE DATABASE IF NOT EXISTS employee_attendance_db;
USE employee_attendance_db;

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  designation VARCHAR(100),
  date_of_joining DATE,
  profile_image VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Attendance table
CREATE TABLE IF NOT EXISTS attendance (
  id INT PRIMARY KEY AUTO_INCREMENT,
  employee_id VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  login_time DATETIME,
  logout_time DATETIME,
  status ENUM('present','absent','half_day','on_leave') DEFAULT 'present',
  total_break_minutes INT DEFAULT 0,
  total_working_minutes INT DEFAULT 0,
  notes TEXT,
  is_corrected TINYINT(1) DEFAULT 0,
  corrected_by VARCHAR(20),
  corrected_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_employee_date (employee_id, date),
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- Break logs table
CREATE TABLE IF NOT EXISTS break_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  attendance_id INT NOT NULL,
  employee_id VARCHAR(20) NOT NULL,
  break_start DATETIME NOT NULL,
  break_end DATETIME,
  break_reason ENUM('lunch_break','tea_break','meeting','personal_work') NOT NULL,
  break_duration_minutes INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (attendance_id) REFERENCES attendance(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(employee_id) ON DELETE CASCADE
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  action_by VARCHAR(20) NOT NULL,
  action_type ENUM('create','update','delete','login','logout','password_reset','attendance_correction') NOT NULL,
  target_table VARCHAR(50),
  target_id VARCHAR(50),
  description TEXT,
  ip_address VARCHAR(45),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Reports table (saved report metadata)
CREATE TABLE IF NOT EXISTS reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_type ENUM('daily','weekly','monthly','performance','working_hours','break_analysis') NOT NULL,
  generated_by VARCHAR(20) NOT NULL,
  date_from DATE,
  date_to DATE,
  file_path VARCHAR(255),
  file_type ENUM('excel','pdf') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Default admin user (password: Admin@123)
INSERT INTO employees (employee_id, first_name, last_name, email, department, designation, date_of_joining)
VALUES ('ADMIN001', 'System', 'Admin', 'admin@company.com', 'IT', 'System Administrator', CURDATE())
ON DUPLICATE KEY UPDATE employee_id = employee_id;

INSERT INTO users (employee_id, password_hash, role)
VALUES ('ADMIN001', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON DUPLICATE KEY UPDATE employee_id = employee_id;

-- Note: Default admin password is 'password' (hashed above)
-- Please change immediately after first login
