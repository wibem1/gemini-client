[Setup]
AppName=KI Workspace Bridge
AppVersion=2.5.0
DefaultDirName={localappdata}\Programs\KI Workspace Bridge
PrivilegesRequired=lowest
OutputDir=installer-output
OutputBaseFilename=KI-Workspace-Bridge-2.5.0
UninstallDisplayName=KI Workspace Bridge
DisableProgramGroupPage=yes

[Dirs]
Name: "{localappdata}\KI Workspace Bridge"; Flags: uninsneveruninstall

[Files]
Source: "bridge.mjs"; DestDir: "{app}"; Flags: ignoreversion
Source: "projects.example.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "Start-Bridge.cmd"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{userprograms}\KI Workspace Bridge"; Filename: "{app}\Start-Bridge.cmd"; WorkingDir: "{app}"
