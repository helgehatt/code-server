/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IssueType, ISettingSearchResult, IssueReporterExtensionData } from 'vs/platform/issue/common/issue';
import { SystemInfo, isRemoteDiagnosticError } from 'vs/platform/diagnostics/common/diagnostics';

export interface IssueReporterData {
	issueType: IssueType;
	issueDescription?: string;

	versionInfo?: any;
	systemInfo?: SystemInfo;
	processInfo?: any;
	workspaceInfo?: any;

	includeSystemInfo: boolean;
	includeWorkspaceInfo: boolean;
	includeProcessInfo: boolean;
	includeExtensions: boolean;
	includeSearchedExtensions: boolean;
	includeSettingsSearchDetails: boolean;

	numberOfThemeExtesions?: number;
	allExtensions: IssueReporterExtensionData[];
	enabledNonThemeExtesions?: IssueReporterExtensionData[];
	extensionsDisabled?: boolean;
	fileOnExtension?: boolean;
	selectedExtension?: IssueReporterExtensionData;
	actualSearchResults?: ISettingSearchResult[];
	query?: string;
	filterResultCount?: number;
}

export class IssueReporterModel {
	private readonly _data: IssueReporterData;

	constructor(initialData?: Partial<IssueReporterData>) {
		const defaultData = {
			issueType: IssueType.Bug,
			includeSystemInfo: true,
			includeWorkspaceInfo: true,
			includeProcessInfo: true,
			includeExtensions: true,
			includeSearchedExtensions: true,
			includeSettingsSearchDetails: true,
			allExtensions: []
		};

		this._data = initialData ? Object.assign(defaultData, initialData) : defaultData;
	}

	getData(): IssueReporterData {
		return this._data;
	}

	update(newData: Partial<IssueReporterData>): void {
		Object.assign(this._data, newData);
	}

	serialize(): string {
		return `
Issue Type: <b>${this.getIssueTypeTitle()}</b>

${this._data.issueDescription}
${this.getExtensionVersion()}
VS Code version: ${this._data.versionInfo && this._data.versionInfo.vscodeVersion}
OS version: ${this._data.versionInfo && this._data.versionInfo.os}
${this.getRemoteOSes()}
${this.getInfos()}
<!-- generated by issue reporter -->`;
	}

	private getRemoteOSes(): string {
		if (this._data.systemInfo && this._data.systemInfo.remoteData.length) {
			return this._data.systemInfo.remoteData
				.map(remote => isRemoteDiagnosticError(remote) ? remote.errorMessage : `Remote OS version: ${remote.machineInfo.os}`).join('\n') + '\n';
		}

		return '';
	}

	fileOnExtension(): boolean | undefined {
		const fileOnExtensionSupported = this._data.issueType === IssueType.Bug
			|| this._data.issueType === IssueType.PerformanceIssue
			|| this._data.issueType === IssueType.FeatureRequest;

		return fileOnExtensionSupported && this._data.fileOnExtension;
	}

	private getExtensionVersion(): string {
		if (this.fileOnExtension() && this._data.selectedExtension) {
			return `\nExtension version: ${this._data.selectedExtension.version}`;
		} else {
			return '';
		}
	}

	private getIssueTypeTitle(): string {
		if (this._data.issueType === IssueType.Bug) {
			return 'Bug';
		} else if (this._data.issueType === IssueType.PerformanceIssue) {
			return 'Performance Issue';
		} else {
			return 'Feature Request';
		}
	}

	private getInfos(): string {
		let info = '';

		if (this._data.issueType === IssueType.Bug || this._data.issueType === IssueType.PerformanceIssue) {
			if (this._data.includeSystemInfo && this._data.systemInfo) {
				info += this.generateSystemInfoMd();
			}
		}

		if (this._data.issueType === IssueType.PerformanceIssue) {

			if (this._data.includeProcessInfo) {
				info += this.generateProcessInfoMd();
			}

			if (this._data.includeWorkspaceInfo) {
				info += this.generateWorkspaceInfoMd();
			}
		}

		if (this._data.issueType === IssueType.Bug || this._data.issueType === IssueType.PerformanceIssue) {
			if (!this._data.fileOnExtension && this._data.includeExtensions) {
				info += this.generateExtensionsMd();
			}
		}

		return info;
	}

	private generateSystemInfoMd(): string {
		let md = `<details>
<summary>System Info</summary>

|Item|Value|
|---|---|
`;

		if (this._data.systemInfo) {

			md += `|CPUs|${this._data.systemInfo.cpus}|
|GPU Status|${Object.keys(this._data.systemInfo.gpuStatus).map(key => `${key}: ${this._data.systemInfo!.gpuStatus[key]}`).join('<br>')}|
|Load (avg)|${this._data.systemInfo.load}|
|Memory (System)|${this._data.systemInfo.memory}|
|Process Argv|${this._data.systemInfo.processArgs}|
|Screen Reader|${this._data.systemInfo.screenReader}|
|VM|${this._data.systemInfo.vmHint}|`;

			if (this._data.systemInfo.linuxEnv) {
				md += `\n|DESKTOP_SESSION|${this._data.systemInfo.linuxEnv.desktopSession}|
|XDG_CURRENT_DESKTOP|${this._data.systemInfo.linuxEnv.xdgCurrentDesktop}|
|XDG_SESSION_DESKTOP|${this._data.systemInfo.linuxEnv.xdgSessionDesktop}|
|XDG_SESSION_TYPE|${this._data.systemInfo.linuxEnv.xdgSessionType}|`;
			}

			this._data.systemInfo.remoteData.forEach(remote => {
				if (isRemoteDiagnosticError(remote)) {
					md += `\n\n${remote.errorMessage}`;
				} else {
					md += `

|Item|Value|
|---|---|
|Remote|${remote.hostName}|
|OS|${remote.machineInfo.os}|
|CPUs|${remote.machineInfo.cpus}|
|Memory (System)|${remote.machineInfo.memory}|
|VM|${remote.machineInfo.vmHint}|`;
				}
			});
		}

		md += '\n</details>';

		return md;
	}

	private generateProcessInfoMd(): string {
		return `<details>
<summary>Process Info</summary>

\`\`\`
${this._data.processInfo}
\`\`\`

</details>
`;
	}

	private generateWorkspaceInfoMd(): string {
		return `<details>
<summary>Workspace Info</summary>

\`\`\`
${this._data.workspaceInfo};
\`\`\`

</details>
`;
	}

	private generateExtensionsMd(): string {
		if (this._data.extensionsDisabled) {
			return 'Extensions disabled';
		}

		const themeExclusionStr = this._data.numberOfThemeExtesions ? `\n(${this._data.numberOfThemeExtesions} theme extensions excluded)` : '';

		if (!this._data.enabledNonThemeExtesions) {
			return 'Extensions: none' + themeExclusionStr;
		}

		const tableHeader = `Extension|Author (truncated)|Version
---|---|---`;
		const table = this._data.enabledNonThemeExtesions.map(e => {
			return `${e.name}|${e.publisher.substr(0, 3)}|${e.version}`;
		}).join('\n');

		return `<details><summary>Extensions (${this._data.enabledNonThemeExtesions.length})</summary>

${tableHeader}
${table}
${themeExclusionStr}

</details>`;
	}
}
