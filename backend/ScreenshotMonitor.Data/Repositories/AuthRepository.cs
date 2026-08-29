using System.Collections.Generic;
using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Dto.Authentication;
using ScreenshotMonitor.Data.Entities;
using ScreenshotMonitor.Data.Repositories.Interfaces;

public class AuthRepository(
    IConfiguration conf,
    SmDbContext dbContext,
    ILogger<AuthRepository> logger
) : IAuthRepository
{
    // Register Admin
    public async Task<string?> RegisterAdmin(User admin)
    {
        try
        {
            var exists = await dbContext.Users.AnyAsync(u => u.Email == admin.Email);
            if (exists)
                throw new Exception("Admin account already exists. Verify email to activate.");

            //admin.Role = "Admin";
            //admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(admin.PasswordHash);

            Console.WriteLine("Trying to access DB");
            await dbContext.Users.AddAsync(admin);
            Console.WriteLine("Successfulyl Accessed and added to DB");
            await dbContext.SaveChangesAsync();
            Console.WriteLine("Saving changes to DB");

            return CreateToken(admin);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error registering admin.");
            return null;
        }
    }

    // Register Employee
    public async Task<string?> RegisterEmployee(User employee)
    {
        try
        {
            var exists = await dbContext.Users.AnyAsync(u => u.Email == employee.Email);
            if (exists)
                throw new Exception("Employee account already exists. Verify email to activate.");

            //employee.Role = "Employee";
            //employee.PasswordHash = BCrypt.Net.BCrypt.HashPassword(employee.PasswordHash);

            await dbContext.Users.AddAsync(employee);
            await dbContext.SaveChangesAsync();

            return "Admin Registration Succesfull!";
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error registering employee.");
            return null;
        }
    }

    // Login Admin
    public async Task<string?> LoginAdmin(string email, string password)
    {
        var admin = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == email && u.Role == "Admin");
        if (admin == null || !BCrypt.Net.BCrypt.Verify(password, admin.PasswordHash))
        {
            logger.LogWarning("Invalid admin login attempt.");
            return null;
        }
        return CreateToken(admin);
    }

    // Login Employee
    public async Task<AuthResult?> LoginEmployee(string email, string password)
    {
        var employee = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == email && u.Role == "Employee");
        if (employee == null || !BCrypt.Net.BCrypt.Verify(password, employee.PasswordHash))
        {
            logger.LogWarning("Invalid employee login attempt.");
            return null;
        }

        // Generate token
        var token = CreateToken(employee);

        // Return both Token and UserId
        return new AuthResult
        {
            Token = token,
            UserId = employee.Id
        };
    }


    // Forgot Password
    public async Task<bool> ForgotPassword(string dtoEmail, string dtoNewPassword, string dtoPhoneNumber)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Email == dtoEmail && u.PhoneNumber == dtoPhoneNumber);
        if (user == null) return false;

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dtoNewPassword);
        await dbContext.SaveChangesAsync();
        return true;
    }

    private string CreateToken(User user)
    {
        List<Claim> claims =
        [
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Role, user.Role)
        ];

        var key =
            new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(
                    conf.GetSection("JWT:Key").Value!
                )
            );
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);
        var token = new JwtSecurityToken(
            issuer: "sehatmand.pk",
            claims: claims,
            expires: DateTime.Now.AddDays(30),
            signingCredentials: creds
        );
        var jwt = new JwtSecurityTokenHandler().WriteToken(token);
        return jwt;
    }
    //// JWT Token Generation
    //private string CreateToken(User user)
    //{
    //    List<Claim> claims =
    //    [
    //        new(ClaimTypes.NameIdentifier, user.Id),
    //        new(ClaimTypes.Email, user.Email),
    //        new(ClaimTypes.Role, user.Role),
    //        //new Claim(JwtRegisteredClaimNames.Aud, "ScreenshotMonitor.Client")
    //    ];

    //    var key = new SymmetricSecurityKey(
    //        Encoding.UTF8.GetBytes(conf.GetSection("JWT:Key").Value!));
    //    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);
    //    var token = new JwtSecurityToken(
    //        issuer: "ssmonitor.pk",
    //        claims: claims,
    //        expires: DateTime.UtcNow.AddDays(30),
    //        signingCredentials: creds
    //    );
    //    var jwt = new JwtSecurityTokenHandler().WriteToken(token);
    //    return jwt;
    //}
}
