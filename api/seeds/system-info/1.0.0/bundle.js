var systemInfo = { id: 'system-info', version: '1.0.0', run: async function(params, ctx) {
  var exec = ctx.exec;
  if (!exec) return { ok: false, error: 'exec no disponible', at: new Date().toISOString() };
  var info = { at: new Date().toISOString() };
  try {
    var osRaw = await exec('powershell -Command "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber,OSArchitecture,RegisteredUser,Organization,CurrentTimeZone,LastBootUpTime,TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"');
    var os = JSON.parse(osRaw.trim());
    info.os = { name: os.Caption, version: os.Version, build: os.BuildNumber, arch: os.OSArchitecture, user: os.RegisteredUser, org: os.Organization, timezone: os.CurrentTimeZone, lastBoot: os.LastBootUpTime };
    info.uptime = { totalMemMB: Math.round(Number(os.TotalVisibleMemorySize)/1024), freeMemMB: Math.round(Number(os.FreePhysicalMemory)/1024), usedMemMB: Math.round((Number(os.TotalVisibleMemorySize)-Number(os.FreePhysicalMemory))/1024), memPercent: Math.round(((Number(os.TotalVisibleMemorySize)-Number(os.FreePhysicalMemory))/Number(os.TotalVisibleMemorySize))*100) };
  } catch(e) { info.os = { error: e.message }; }
  try {
    var cpuRaw = await exec('powershell -Command "Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors,MaxClockSpeed,CurrentClockSpeed,LoadPercentage | ConvertTo-Json"');
    var cpu = JSON.parse(cpuRaw.trim());
    info.cpu = { model: cpu.Name, cores: cpu.NumberOfCores, threads: cpu.NumberOfLogicalProcessors, maxMHz: cpu.MaxClockSpeed, currentMHz: cpu.CurrentClockSpeed, load: cpu.LoadPercentage };
  } catch(e) { info.cpu = { error: e.message }; }
  try {
    var gpu = null;
    try {
      var gpuRaw = await exec('powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor,CurrentHorizontalResolution | ConvertTo-Json"');
      gpu = JSON.parse(gpuRaw.trim());
    } catch(e1) {
      try {
        var gpuRaw2 = await exec('powershell -NoProfile -Command "Get-WmiObject Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor | ConvertTo-Json"');
        gpu = JSON.parse(gpuRaw2.trim());
      } catch(e2) {
        var gpuRaw3 = await exec('powershell -NoProfile -Command "Get-ItemProperty \'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\0*\' | Select-Object DriverDesc | ConvertTo-Json"');
        gpu = JSON.parse(gpuRaw3.trim());
      }
    }
    var gpuList = Array.isArray(gpu) ? gpu : [gpu];
    info.gpu = gpuList.filter(function(g) { return g && g.Name; }).map(function(g) { return { name: g.Name, vramMB: g.AdapterRAM ? Math.round(g.AdapterRAM/1048576) : null, driver: g.DriverVersion || null, processor: g.VideoProcessor || null, resolution: g.CurrentHorizontalResolution ? g.CurrentHorizontalResolution+'px' : null }; });
    if (info.gpu.length === 0) info.gpu = 'N/A';
  } catch(e) { info.gpu = 'N/A'; }
  try {
    var mbRaw = await exec('powershell -Command "Get-CimInstance Win32_BaseBoard | Select-Object Manufacturer,Product,Version,SerialNumber | ConvertTo-Json"');
    var mb = JSON.parse(mbRaw.trim());
    info.motherboard = { manufacturer: mb.Manufacturer, model: mb.Product, version: mb.Version, serial: mb.SerialNumber };
  } catch(e) { info.motherboard = { error: e.message }; }
  try {
    var biosRaw = await exec('powershell -Command "Get-CimInstance Win32_BIOS | Select-Object Name,Manufacturer,Version,ReleaseDate,SerialNumber | ConvertTo-Json"');
    var bios = JSON.parse(biosRaw.trim());
    info.bios = { name: bios.Name, manufacturer: bios.Manufacturer, version: bios.Version, date: bios.ReleaseDate, serial: bios.SerialNumber };
  } catch(e) { info.bios = { error: e.message }; }
  try {
    var diskRaw = await exec('powershell -Command "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID,VolumeName,Size,FreeSpace,FileSystem,DriveType,ProviderName | ConvertTo-Json"');
    var disks = JSON.parse(diskRaw.trim());
    var diskList = Array.isArray(disks) ? disks : [disks];
    info.disks = diskList.filter(function(d) { return d.DriveType === 3; }).map(function(d) { return { letter: d.DeviceID, label: d.VolumeName, totalGB: d.Size ? Math.round(Number(d.Size)/1073741824*10)/10 : null, freeGB: d.FreeSpace ? Math.round(Number(d.FreeSpace)/1073741824*10)/10 : null, usedGB: d.Size && d.FreeSpace ? Math.round((Number(d.Size)-Number(d.FreeSpace))/1073741824*10)/10 : null, fs: d.FileSystem }; });
  } catch(e) { info.disks = { error: e.message }; }
  try {
    var netRaw = await exec('powershell -Command "Get-NetAdapter | Where-Object {$_.Status -eq \'Up\'} | Select-Object Name,InterfaceDescription,MacAddress,LinkSpeed,Status | ConvertTo-Json"');
    var nets = JSON.parse(netRaw.trim());
    var netList = Array.isArray(nets) ? nets : [nets];
    info.network = netList.map(function(n) { return { name: n.Name, description: n.InterfaceDescription, mac: n.MacAddress, speed: n.LinkSpeed, status: n.Status }; });
  } catch(e) { info.network = { error: e.message }; }
  try {
    var ipRaw = await exec('powershell -Command "Get-NetIPAddress | Where-Object {$_.AddressFamily -eq \'IPv4\' -and $_.IPAddress -ne \'127.0.0.1\'} | Select-Object IPAddress,InterfaceAlias,PrefixLength | ConvertTo-Json"');
    var ips = JSON.parse(ipRaw.trim());
    var ipList = Array.isArray(ips) ? ips : [ips];
    info.ipAddresses = ipList.map(function(i) { return { ip: i.IPAddress, interface: i.InterfaceAlias, prefix: i.PrefixLength }; });
  } catch(e) { info.ipAddresses = { error: e.message }; }
  try {
    var gwRaw = await exec('powershell -Command "Get-NetRoute | Where-Object {$_.DestinationPrefix -eq \'0.0.0.0/0\'} | Select-Object NextHop | ConvertTo-Json"');
    var gw = JSON.parse(gwRaw.trim());
    var gwList = Array.isArray(gw) ? gw : [gw];
    info.gateway = gwList.map(function(g) { return g.NextHop; });
  } catch(e) { info.gateway = { error: e.message }; }
  try {
    var dnsRaw = await exec('powershell -Command "Get-DnsClientServerAddress | Where-Object {$_.AddressFamily -eq \'IPv4\'} | Select-Object ServerAddresses,InterfaceAlias | ConvertTo-Json"');
    var dns = JSON.parse(dnsRaw.trim());
    var dnsList = Array.isArray(dns) ? dns : [dns];
    info.dns = dnsList.map(function(d) { return { servers: d.ServerAddresses, interface: d.InterfaceAlias }; });
  } catch(e) { info.dns = { error: e.message }; }
  try {
    var wifiRaw = await exec('powershell -Command "netsh wlan show interfaces"');
    var ssidMatch = wifiRaw.match(/SSID\s*:\s*(.+)/i);
    var signalMatch = wifiRaw.match(/Signal\s*:\s*(\d+)%/i);
    var speedMatch = wifiRaw.match(/Receive\/Transmit\s*rate\s*:\s*(\d+)/i);
    info.wifi = ssidMatch ? { ssid: ssidMatch[1].trim(), signal: signalMatch ? signalMatch[1]+'%' : null, speed: speedMatch ? speedMatch[1]+' Mbps' : null } : { connected: false };
  } catch(e) { info.wifi = { error: e.message }; }
  try {
    var procRaw = await exec('powershell -Command "Get-Process | Sort-Object CPU -Descending | Select-Object -First 10 Name,Id,CPU,WorkingSet64 | ConvertTo-Json"');
    var procs = JSON.parse(procRaw.trim());
    var procList = Array.isArray(procs) ? procs : [procs];
    info.topProcesses = procList.map(function(p) { return { name: p.Name, pid: p.Id, cpuSec: p.CPU ? Math.round(p.CPU*10)/10 : 0, ramMB: p.WorkingSet64 ? Math.round(p.WorkingSet64/1048576) : 0 }; });
    var totalProcRaw = await exec('powershell -Command "(Get-Process).Count"');
    info.processCount = Number(totalProcRaw.trim());
  } catch(e) { info.topProcesses = { error: e.message }; }
  try {
    var secRaw = await exec('powershell -Command "$av = Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue; $fw = Get-NetFirewallProfile | Select-Object Name,Enabled; $wu = (New-Object -ComObject Microsoft.Update.AutoUpdate).Results | Select-Object LastInstallationDate; @{antivirus=$av; firewall=$fw; lastUpdate=$wu} | ConvertTo-Json -Depth 3"');
    var sec = JSON.parse(secRaw.trim());
    var avList = sec.antivirus ? (Array.isArray(sec.antivirus) ? sec.antivirus : [sec.antivirus]) : [];
    info.security = { antivirus: avList.map(function(a) { return { name: a.displayName, state: a.productState, path: a.pathToSignedProductExe }; }), firewall: sec.firewall ? (Array.isArray(sec.firewall) ? sec.firewall : [sec.firewall]).map(function(f) { return { profile: f.Name, enabled: f.Enabled }; }) : [], lastUpdate: sec.lastUpdate ? sec.lastUpdate.LastInstallationDate : null };
  } catch(e) { info.security = { error: e.message }; }
  try {
    var swRaw = await exec('powershell -Command "Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* | Where-Object {$_.DisplayName -ne $null} | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate | Sort-Object DisplayName | ConvertTo-Json"');
    var softwares = JSON.parse(swRaw.trim());
    var swList = Array.isArray(softwares) ? softwares : [softwares];
    info.installedSoftware = swList.slice(0, 50).map(function(s) { return { name: s.DisplayName, version: s.DisplayVersion, publisher: s.Publisher, installed: s.InstallDate }; });
  } catch(e) { info.installedSoftware = { error: e.message }; }
  try {
    var monRaw = await exec('powershell -Command "Get-CimInstance Win32_DesktopMonitor | Select-Object ScreenWidth,ScreenHeight | ConvertTo-Json"');
    var mon = JSON.parse(monRaw.trim());
    var monList = Array.isArray(mon) ? mon : [mon];
    info.monitors = monList.map(function(m) { return { width: m.ScreenWidth, height: m.ScreenHeight }; });
  } catch(e) { info.monitors = { error: e.message }; }
  try {
    var usbRaw = await exec('powershell -Command "Get-CimInstance Win32_USBControllerDevice | ForEach-Object { [wmi]$_.Dependent } | Select-Object Name,DeviceID,Description | ConvertTo-Json"');
    var usbs = JSON.parse(usbRaw.trim());
    var usbList = Array.isArray(usbs) ? usbs : [usbs];
    info.usbDevices = usbList.slice(0, 20).map(function(u) { return { name: u.Name, id: u.DeviceID, description: u.Description }; });
  } catch(e) { info.usbDevices = { error: e.message }; }
  try {
    var printRaw = await exec('powershell -Command "Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus,Shared | ConvertTo-Json"');
    var printers = JSON.parse(printRaw.trim());
    var printList = Array.isArray(printers) ? printers : [printers];
    info.printers = printList.map(function(p) { return { name: p.Name, driver: p.DriverName, port: p.PortName, status: p.PrinterStatus, shared: p.Shared }; });
  } catch(e) { info.printers = { error: e.message }; }
  try {
    var btRaw = await exec('powershell -Command "Get-Service bthserv -ErrorAction SilentlyContinue | Select-Object Status | ConvertTo-Json"');
    var bt = JSON.parse(btRaw.trim());
    info.bluetooth = { enabled: bt.Status === 'Running' };
  } catch(e) { info.bluetooth = { enabled: false }; }
  try {
    var usersRaw = await exec('powershell -Command "query user"');
    var userLines = usersRaw.split('\n').filter(function(l) { return l.trim().indexOf('USERNAME') === -1 && l.trim().length > 0; });
    info.loggedUsers = userLines.map(function(l) { var parts = l.split(/\s+/).filter(Boolean); return { user: parts[0], session: parts[1], id: parts[2], state: parts[3], logon: parts[4] ? parts[4]+' '+parts[5] : null }; });
  } catch(e) { info.loggedUsers = []; }
  try {
    var hostRaw = await exec('powershell -Command "$env:COMPUTERNAME"');
    info.hostname = hostRaw.trim();
  } catch(e) { info.hostname = null; }
  try {
    var localRaw = await exec('powershell -Command "Get-WinSystemLocale | Select-Object DisplayName,Name | ConvertTo-Json"');
    var locale = JSON.parse(localRaw.trim());
    info.locale = { name: locale.DisplayName, code: locale.Name };
  } catch(e) { info.locale = { error: e.message }; }
  return { ok: true, output: info, at: new Date().toISOString() };
} };
