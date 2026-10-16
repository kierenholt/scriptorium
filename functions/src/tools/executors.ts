import {
  ToolExecutionResult,
  UpdateStatusArgs,
  RenameProjectArgs,
  UpdateDescriptionArgs,
  ProjectTagArgs,
  SearchTalentArgs,
  IndexTalentArgs,
  ReadEmailArgs,
  SendEmailArgs,
  SaveProjectArtifactArgs,
  GetProjectArtifactDownloadUrlArgs,
  LookupProjectRecordArgs,
  ListRecentProjectsArgs,
  LookupProjectArtifactArgs,
  GetProjectsFromEmailSenderArgs,
  AssignEmailToProjectArgs,
  ListUnassignedInboxEmailsArgs,
} from './types';
import {
  executeUpdateStatus,
  executeRenameProject,
  executeUpdateDescription,
  executeAddTag,
  executeRemoveTag,
  executeSaveProjectArtifact,
  executeGetProjectArtifactDownloadUrl,
  executeLookupProjectRecord,
  executeListRecentProjects,
  executeLookupProjectArtifact,
} from './projectExecutors';
import {
  executeSearchTalentPool,
  executeIndexTalentCv,
} from './talentExecutors';
import {
  executeReadCandidateEmailMessage,
  executeSendCandidateEmailMessage,
  executeGetProjectsFromEmailSender,
  executeAssignEmailToProject,
  executeListUnassignedInboxEmails,
} from './emailExecutors';

// Re-export all types and domain executors for seamless backwards compatibility
export * from './types';
export * from './projectExecutors';
export * from './talentExecutors';
export * from './emailExecutors';

/**
 * Tool dispatcher mapping domain-specific function names to executors.
 * Acts as the translation layer between agent tool calls and generic infrastructure mutations.
 */
export async function dispatchToolCall(
  projectId: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<ToolExecutionResult> {
  switch (toolName) {
    case 'updateProjectLifecycleStage':
    case 'updateStatus':
      return executeUpdateStatus(projectId, args as UpdateStatusArgs);

    case 'renameProjectDocument':
    case 'renameProject':
      return executeRenameProject(projectId, args as RenameProjectArgs);

    case 'updateProjectBriefDescription':
    case 'updateDescription':
      return executeUpdateDescription(projectId, args as UpdateDescriptionArgs);

    case 'addProjectRequirementTag':
    case 'addTag':
      return executeAddTag(projectId, args as ProjectTagArgs);

    case 'removeProjectRequirementTag':
    case 'removeTag':
      return executeRemoveTag(projectId, args as ProjectTagArgs);

    case 'searchTalentPool':
    case 'searchTalent':
      return executeSearchTalentPool(projectId, args as SearchTalentArgs);

    case 'indexTalentCv':
    case 'indexTalentProfile':
      return executeIndexTalentCv(projectId, args as IndexTalentArgs);

    case 'readCandidateEmailMessage':
    case 'readEmail':
    case 'checkReceivedEmail':
      return executeReadCandidateEmailMessage(projectId, args as ReadEmailArgs);

    case 'sendCandidateEmailMessage':
    case 'sendEmail':
    case 'dispatchEmail':
      return executeSendCandidateEmailMessage(projectId, args as SendEmailArgs);

    case 'saveProjectArtifact':
    case 'saveArtifact':
    case 'attachProjectDeliverable':
      return executeSaveProjectArtifact(projectId, args as SaveProjectArtifactArgs);

    case 'getProjectArtifactDownloadUrl':
    case 'getArtifactDownloadUrl':
    case 'retrieveProjectArtifact':
      return executeGetProjectArtifactDownloadUrl(projectId, args as GetProjectArtifactDownloadUrlArgs);

    case 'lookupProjectRecord':
    case 'getProject':
    case 'getProjectDetails':
      return executeLookupProjectRecord(projectId, args as LookupProjectRecordArgs);

    case 'listRecentProjects':
      return executeListRecentProjects(projectId, args as ListRecentProjectsArgs);

    case 'lookupProjectArtifact':
      return executeLookupProjectArtifact(projectId, args as LookupProjectArtifactArgs);

    case 'getProjectsFromEmailSender':
    case 'getProjectsFromSender':
    case 'lookupProjectsByEmailSender':
      return executeGetProjectsFromEmailSender(projectId, args as GetProjectsFromEmailSenderArgs);

    case 'assignEmailToProject':
    case 'moveEmailToProject':
    case 'associateEmailWithProject':
      return executeAssignEmailToProject(projectId, args as AssignEmailToProjectArgs);

    case 'listUnassignedInboxEmails':
    case 'listInboxEmails':
      return executeListUnassignedInboxEmails(projectId, args as ListUnassignedInboxEmailsArgs);

    default:
      return {
        success: false,
        error: `Unknown tool "${toolName}".`,
        message: `Tool "${toolName}" is not recognized by Scriptorium.`,
      };
  }
}
