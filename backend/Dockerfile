FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY backend/ScreenshotMonitor.API/ScreenshotMonitor.API.csproj backend/ScreenshotMonitor.API/
COPY backend/ScreenshotMonitor.Data/ScreenshotMonitor.Data.csproj backend/ScreenshotMonitor.Data/
COPY backend/ScreenshotMonitor.SignalR/ScreenshotMonitor.SignalR.csproj backend/ScreenshotMonitor.SignalR/
RUN dotnet restore backend/ScreenshotMonitor.API/ScreenshotMonitor.API.csproj

COPY backend/ backend/
RUN dotnet publish backend/ScreenshotMonitor.API/ScreenshotMonitor.API.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/Uploads

EXPOSE 8080
ENTRYPOINT ["sh", "-c", "exec dotnet ScreenshotMonitor.API.dll --urls http://0.0.0.0:${PORT:-8080}"]
