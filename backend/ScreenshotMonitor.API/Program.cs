using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using ScreenshotMonitor.Data.Context;
using ScreenshotMonitor.Data.Repositories;
using System.Text;
using ScreenshotMonitor.Data.Repositories.Interfaces;
using ScreenshotMonitor.Data.Interfaces.Repositories;
using Microsoft.OpenApi.Models;
using System.Text.Json.Serialization;
using ScreenshotMonitor.Data.Interfaces;
using ScreenshotMonitor.SignalR;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});
// Register DbContext
var config = builder.Configuration;
// Add Authentication service

builder.Services.AddDbContext<SmDbContext>(options => options.UseNpgsql(config.GetConnectionString("SmDb")!));

builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options=>
{
    options.MultipartBodyLengthLimit = 100*1024*1024;
});

builder.Services.AddScoped<DbContext, SmDbContext>();
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
builder.Services.AddScoped<IAdminRepository, AdminRepository>();
builder.Services.AddScoped<IProjectRepository, ProjectRepository>();
builder.Services.AddScoped<ISessionRepository, SessionRepository>();
builder.Services.AddScoped<ISessionAppsRepository, SessionAppsRepository>();
builder.Services.AddScoped<IScreenshotRepository, ScreenshotRepository>();
builder.Services.AddScoped<IDashboardRepository, DashboardRepository>();


builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = "https://localhost:7037";
        options.Audience = "SehatMand.Client";
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey
                (Encoding.UTF8.GetBytes(config.GetSection("JWT:Key").Value!)),
            ClockSkew = TimeSpan.Zero
        };

        // 👇 THIS PART EXTRACTS THE TOKEN FROM SIGNALR REQUESTS
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];

                // If the request is for SignalR, use the token from the query string
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/useractivityhub"))
                {
                    context.Token = accessToken;
                }

                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(c => {
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "JWTToken_Auth_API",
        Version = "v1"
    });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme()
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "JWT Authorization header using the Bearer scheme. \r\n\r\n Enter 'Bearer' [space] and then your token in the text input below.\r\n\r\nExample: \"Bearer 1safsfsdfdfd\"",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement {
        {
            new OpenApiSecurityScheme {
                Reference = new OpenApiReference {
                    Type = ReferenceType.SecurityScheme,
                        Id = "Bearer"
                }
            },
            new string[] {}
        }
    });
});

builder.Services.AddSignalR()
    .AddMessagePackProtocol();
  

var app = builder.Build();

app.UseAuthentication();  // Add Authentication middleware

var storagePath = builder.Configuration["FileStorage:UploadPath"] ?? "/var/www/Uploads/";
Directory.CreateDirectory(storagePath); // Ensure the folder exists


app.UseCors(x => x
    .AllowAnyMethod()
    .AllowAnyHeader()
    .SetIsOriginAllowed(origin => true) // allow any origin
    .AllowCredentials());

// Configure the HTTP request pipeline (authentication & authorization middleware).
app.UseAuthentication();  // Add Authentication middleware
app.UseAuthorization();   // Add Authorization middleware

// Ensure the database is created and migrations are applied
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<SmDbContext>();

    try
    {
        Console.WriteLine("Checking database connection...");
        dbContext.Database.CanConnect(); // Checks if the database is reachable
        Console.WriteLine("Database connection is successful.");

        // Ensure database is created if it doesn�t exist
        //dbContext.Database.EnsureCreated();

        // Apply any pending migrations
        //dbContext.Database.Migrate();
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Database connection failed: {ex.Message}");
    }
}


// Configure middleware
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.MapHub<UserActivityHub>("/useractivityhub");
app.MapHub<ScreenHub>("/screenHub");
app.MapControllers();
app.Run();
