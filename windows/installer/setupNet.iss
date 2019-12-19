; Script generated by the Inno Script Studio Wizard.
; SEE THE DOCUMENTATION FOR DETAILS ON CREATING INNO SETUP SCRIPT FILES!

#define MyAppName "AvNavNet"
#define ExeSource "..\\AvChartConvert\\AvChartConvert\\bin\\x86\\ReleaseNet\\AvChartConvert.exe"
#define MyAppVersion GetFileVersion(ExeSource)
#define MyAppVersionMinus StringChange(MyAppVersion,".","-")
;#define MyAppVersion "2015-10-16"
#define MyAppPublisher "Andreas Vogel"
#define MyAppURL "http://www.wellenvogel.de/software/avnav"
#define MyAppExeName "AvChartConvert.exe"
#define RegKey "SOFTWARE\AvNav"
#define KeyUnistallBase "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\"



[Setup]
; NOTE: The value of AppId uniquely identifies this application.
; Do not use the same AppId value in installers for other applications.
; (To generate a new GUID, click Tools | Generate GUID inside the IDE.)
AppId={{832C93A9-F8FA-4EE4-9447-2645D4340A13}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
;AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={pf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputBaseFilename=AvNavNetSetup-{#MyAppVersionMinus}
Compression=lzma
SolidCompression=yes
ChangesEnvironment=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: {#ExeSource}; DestDir: "{app}"; Flags: ignoreversion
; NOTE: Don't use "Flags: ignoreversion" on any shared system files
Source: "..\downloadAndInstall.ps1"; DestDir: "{app}\windows"; DestName: "downloadAndInstall.ps1"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Flags: nowait postinstall skipifsilent; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"

[Registry]
Root: "HKLM"; Subkey: "{#RegKey}"; ValueType: string; ValueName: "InstallDir"; ValueData: "{app}"; Flags: createvalueifdoesntexist  uninsdeletekey

[PreCompile]
Name: "build.cmd"; Flags: abortonerror cmdprompt redirectoutput







