import { Type, type FunctionDeclaration } from '@google/genai';

export const updateProjectLifecycleStageDeclaration: FunctionDeclaration = {
  name: 'updateProjectLifecycleStage',
  description:
    'Update the operational lifecycle stage of a Scriptorium project. Use when the supervisor asks to advance, complete, block, or revert the project state (e.g., "set status to completed", "mark project as in progress", "block the project"). Do NOT use this tool for updating project details like title, description, or skill tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      status: {
        type: Type.STRING,
        enum: ['draft', 'in_progress', 'blocked', 'completed'],
        description: 'The target lifecycle stage for the project (draft, in_progress, blocked, completed).',
      },
    },
    required: ['status'],
  },
};

export const renameProjectDocumentDeclaration: FunctionDeclaration = {
  name: 'renameProjectDocument',
  description:
    'Update the official title or initiative name of the Scriptorium project. Use when the supervisor instructs to rename the project or assign a new title (e.g., "rename project to Omega Initiative", "change project title"). Do NOT use this tool for changing the project brief description, status, or tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The new title for the project.',
      },
    },
    required: ['title'],
  },
};

export const updateProjectBriefDescriptionDeclaration: FunctionDeclaration = {
  name: 'updateProjectBriefDescription',
  description:
    'Update the scope, brief, or textual requirements description of the project. Use when the supervisor asks to modify the project overview, brief summary, or scope details (e.g., "update the project description to include French transcreation"). Do NOT use this tool for renaming the project, updating lifecycle status, or adding individual skill tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      description: {
        type: Type.STRING,
        description: 'The comprehensive brief or description of the project.',
      },
    },
    required: ['description'],
  },
};

export const addProjectRequirementTagDeclaration: FunctionDeclaration = {
  name: 'addProjectRequirementTag',
  description:
    'Append a required skill, discipline, or qualification tag to the project specification. Use when the supervisor requests adding required competencies or deliverables (e.g., "add copywriter tag", "tag this project with AI post-editing", "add transcreation requirement"). Do NOT use this tool for updating project status or modifying the project title.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tag: {
        type: Type.STRING,
        description: 'The skill, discipline, or competency tag to append to the project requirements.',
      },
    },
    required: ['tag'],
  },
};

export const removeProjectRequirementTagDeclaration: FunctionDeclaration = {
  name: 'removeProjectRequirementTag',
  description:
    'Remove an existing skill, discipline, or qualification tag from the project specification. Use when the supervisor asks to remove or deselect a required tag (e.g., "remove copywriter tag", "delete the French tag"). Do NOT use this tool for project title or status mutations.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      tag: {
        type: Type.STRING,
        description: 'The skill or discipline tag to remove from the project requirements.',
      },
    },
    required: ['tag'],
  },
};

export const searchTalentPoolDeclaration: FunctionDeclaration = {
  name: 'searchTalentPool',
  description:
    'Search the vetted Scriptorium talent pool and candidate CV repository using semantic matching. Use when the supervisor asks to find, source, or shortlist candidates, freelancers, or specialists (e.g., "find me 3 German transcreation specialists", "search for copywriters with medical experience"). Do NOT use this tool for editing project documents or mutating project status.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'The natural language search query describing desired skills, languages, or creative disciplines.',
      },
      minYearsExperience: {
        type: Type.INTEGER,
        description: 'Optional minimum verified years of professional experience required for the brief.',
      },
      vettedOnly: {
        type: Type.BOOLEAN,
        description: 'Whether to restrict the search to pre-tested and verified Scriptorium talent.',
      },
      filter: {
        type: Type.STRING,
        description: 'Optional structured metadata filter expression (e.g. location or specific discipline).',
      },
      pageSize: {
        type: Type.INTEGER,
        description: 'Maximum number of candidate profile cards to return (default: 5).',
      },
    },
    required: ['query'],
  },
};

export const indexTalentCvDeclaration: FunctionDeclaration = {
  name: 'indexTalentCv',
  description:
    'Index and register a candidate CV or talent profile into the Scriptorium searchable candidate repository using Vertex AI Search. Use when the supervisor asks to register, upload, index, or add a new candidate or freelancer (e.g., "index this candidate CV", "add Alice to our vetted copywriter pool", "save this profile to the talent repository"). Do NOT use this tool for modifying project requirements, changing project lifecycle status, or searching existing talent.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: {
        type: Type.STRING,
        description: 'Full name of the candidate or freelance specialist to register into Scriptorium.',
      },
      role: {
        type: Type.STRING,
        description: 'Primary creative or linguistic role (e.g., "Transcreation Specialist", "Copywriter", "AI Post-Editor").',
      },
      skills: {
        type: Type.STRING,
        description: 'Key skills, competencies, and language pairs possessed by the candidate.',
      },
      location: {
        type: Type.STRING,
        description: 'Candidate primary operating location or target market (e.g., "London, UK", "Berlin, Germany").',
      },
      yearsExperience: {
        type: Type.INTEGER,
        description: 'Number of verified years of professional industry experience.',
      },
      summary: {
        type: Type.STRING,
        description: 'Concise professional summary, background, or craft evaluation notes for the talent.',
      },
    },
    required: ['name', 'role', 'skills'],
  },
};

export const readCandidateEmailMessageDeclaration: FunctionDeclaration = {
  name: 'readCandidateEmailMessage',
  description:
    'Read, search, or inspect dispatched and received candidate or hirer email communications. Use when the supervisor asks to check received emails, inspect email communications, retrieve a verification token or message sent via email, or find an email by recipient or subject (e.g., "check our received emails", "read the email sent to...", "find the verification token email", "what did the email say?"). Do NOT use this tool for modifying project requirements, changing project lifecycle status, or searching candidate CV profiles in Discovery Engine.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Search term or keyword to match against email subject or body text (e.g., "Verification Token", "Applicant Dossier", "Credentials").',
      },
      recipient: {
        type: Type.STRING,
        description: 'Optional recipient email address to filter emails by.',
      },
      sender: {
        type: Type.STRING,
        description: 'Optional sender email address to filter received emails by.',
      },
      emailId: {
        type: Type.STRING,
        description: 'Optional specific Resend or internal email ID to retrieve directly.',
      },
    },
  },
};

export const sendCandidateEmailMessageDeclaration: FunctionDeclaration = {
  name: 'sendCandidateEmailMessage',
  description:
    'Dispatch transactional outbound email communications to a candidate, client, or team member regarding brief requirements, account notifications, or updates. Use when the supervisor asks to send an email, dispatch message, or email someone (e.g., "send an email to...", "email candidate with...", "dispatch email to..."). Do NOT use this tool for reading incoming emails, modifying project status, or updating project tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      to: {
        type: Type.STRING,
        description: 'Target recipient email address to send the message to.',
      },
      subject: {
        type: Type.STRING,
        description: 'Subject line of the email to dispatch.',
      },
      body: {
        type: Type.STRING,
        description: 'The body text or HTML content of the email message.',
      },
    },
    required: ['to', 'subject', 'body'],
  },
};

export const saveProjectArtifactDeclaration: FunctionDeclaration = {
  name: 'saveProjectArtifact',
  description:
    'Save and promote an uploaded file or deliverable document (such as an approved brief, client dossier, candidate assessment, or campaign spec) into the permanent Scriptorium project artifacts repository and register it in the project document. Use when the supervisor asks to "save this uploaded brief to project artifacts", "archive this deliverable", "promote the uploaded file into project artifacts", or "save deliverable to project". Do NOT use this tool for project status updates, modifying brief description text, tagging requirements, or indexing talent CVs into the candidate search engine.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      sourceFileUri: {
        type: Type.STRING,
        description: 'The Google Cloud Storage URI (gs://...) of the uploaded file to promote into project artifacts.',
      },
      artifactName: {
        type: Type.STRING,
        description: 'The target file name or deliverable title for the artifact in the project repository (e.g. "Campaign_Brief_v1.pdf").',
      },
      mimeType: {
        type: Type.STRING,
        description: 'Optional explicit MIME type of the artifact document (e.g. "application/pdf").',
      },
      comment: {
        type: Type.STRING,
        description: 'Optional supervisor notes, brief context, or descriptive comment attached to this project artifact.',
      },
    },
    required: ['sourceFileUri', 'artifactName'],
  },
};

export const getProjectArtifactDownloadUrlDeclaration: FunctionDeclaration = {
  name: 'getProjectArtifactDownloadUrl',
  description:
    'Retrieve a saved project artifact document from the project repository and generate a secure timeboxed download link. Use when the supervisor asks to "retrieve artifact", "get download link for document", "download artifact with comment", "get artifact URL", or look up an artifact by its ID, filename, or comment description. Do NOT use this tool for saving new artifacts, updating project status, or searching candidate CVs.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: 'Search keyword, comment phrase, filename, or artifact ID to locate the desired artifact within the project repository.',
      },
      artifactId: {
        type: Type.STRING,
        description: 'Optional exact artifact ID (e.g. "art_1739...").',
      },
      comment: {
        type: Type.STRING,
        description: 'Optional specific comment or description keyword to match against stored project artifacts.',
      },
      expiresInMinutes: {
        type: Type.INTEGER,
        description: 'Duration in minutes for which the secure download URL remains valid (default: 15).',
      },
    },
    required: ['query'],
  },
};

export const lookupProjectRecordDeclaration: FunctionDeclaration = {
  name: 'lookupProjectRecord',
  description:
    'Look up and retrieve a Scriptorium project document from Firestore by its project ID (e.g. "pr-7k4x9q") to inspect its current title, status, description, skill tags, and attached deliverable artifacts. Use when the supervisor asks to "look up project pr-...", "get project details", "fetch project record", "inspect project pr-...", or "check project status". Do NOT use this tool for updating project fields, changing lifecycle status, or searching candidate talent pools.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      projectId: {
        type: Type.STRING,
        description: 'The unique project identifier strictly adhering to the pr-xxxxxx format (e.g. "pr-7k4x9q").',
      },
    },
    required: ['projectId'],
  },
};

export const listRecentProjectsDeclaration: FunctionDeclaration = {
  name: 'listRecentProjects',
  description:
    'Retrieve a summary list of recently active or created Scriptorium project records, including their unique project IDs, titles, lifecycle statuses, and competency tags. Use when the supervisor asks to "list projects", "show recent projects", "find active projects", or "what projects exist in the hub". Do NOT use this tool for fetching artifact download URLs, modifying project documents, or searching candidate talent pools.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.INTEGER,
        description: 'Maximum number of recent project records to retrieve from the repository (default: 10, maximum: 50).',
      },
    },
  },
};

export const lookupProjectArtifactDeclaration: FunctionDeclaration = {
  name: 'lookupProjectArtifact',
  description:
    'Look up and inspect metadata for a saved project deliverable, brief, or dossier artifact within the current project repository using its artifact ID (ar-xxxxxx) or document filename. Use when the supervisor asks to "look up artifact ar-...", "check artifact details", "inspect deliverable metadata", or "find project artifact". Do NOT use this tool for generating secure timeboxed download links (use getProjectArtifactDownloadUrl instead) or saving new files.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      artifactId: {
        type: Type.STRING,
        description: 'The unique artifact identifier strictly adhering to the ar-xxxxxx format (e.g. "ar-8m2p9k").',
      },
      name: {
        type: Type.STRING,
        description: 'The document filename or deliverable name of the artifact in the project repository (e.g. "Campaign_Brief_v1.pdf").',
      },
    },
  },
};

export const getProjectsFromEmailSenderDeclaration: FunctionDeclaration = {
  name: 'getProjectsFromEmailSender',
  description:
    'Identify and list all Scriptorium projects that have corresponded with, received messages from, or contacted a specific candidate or email sender address. Use when the supervisor asks "which project does this email belong to?", "find projects for sender", "what project has corresponded with this candidate?", or "get projects from sender email". Do NOT use this tool for moving or assigning emails to a project, sending new messages, or modifying project requirements.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      senderEmail: {
        type: Type.STRING,
        description: 'The email address of the candidate or sender to look up across existing project correspondence.',
      },
    },
    required: ['senderEmail'],
  },
};

export const assignEmailToProjectDeclaration: FunctionDeclaration = {
  name: 'assignEmailToProject',
  description:
    'Explicitly move, associate, and store an inbound or unassigned email message into a specific Scriptorium project document. Use when the supervisor asks to "assign this email to the project", "move email em-... into project pr-...", "link incoming email to this project", or "associate email with project". Do NOT use this tool for drafting or sending new outbound emails, searching candidate talent pools, or editing project tags.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      emailId: {
        type: Type.STRING,
        description: 'The unique identifier of the email record to assign (e.g. "em-xxxxxx").',
      },
      projectId: {
        type: Type.STRING,
        description: 'Optional target project ID strictly adhering to pr-xxxxxx format (defaults to the currently active project).',
      },
    },
    required: ['emailId'],
  },
};

export const listUnassignedInboxEmailsDeclaration: FunctionDeclaration = {
  name: 'listUnassignedInboxEmails',
  description:
    'Inspect and list unassigned incoming candidate or client emails waiting in the inbox that have not yet been associated with any Scriptorium project. Use when the supervisor asks to "check incoming emails in the inbox", "list unassigned emails", "what incoming emails do we have?", or "show inbox messages". Do NOT use this tool for assigning emails to a project, sending new emails, or modifying project lifecycle status.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.INTEGER,
        description: 'Maximum number of unassigned inbox emails to retrieve (default: 10, max: 50).',
      },
    },
  },
};

// Backwards-compatible aliases
export const updateStatusDeclaration = updateProjectLifecycleStageDeclaration;
export const renameProjectDeclaration = renameProjectDocumentDeclaration;
export const updateDescriptionDeclaration = updateProjectBriefDescriptionDeclaration;
export const addTagDeclaration = addProjectRequirementTagDeclaration;
export const removeTagDeclaration = removeProjectRequirementTagDeclaration;
export const searchTalentDeclaration = searchTalentPoolDeclaration;
export const indexTalentProfileDeclaration = indexTalentCvDeclaration;
export const readEmailDeclaration = readCandidateEmailMessageDeclaration;
export const sendEmailDeclaration = sendCandidateEmailMessageDeclaration;
export const dispatchEmailDeclaration = sendCandidateEmailMessageDeclaration;
export const saveArtifactDeclaration = saveProjectArtifactDeclaration;
export const attachProjectDeliverableDeclaration = saveProjectArtifactDeclaration;
export const getArtifactDownloadUrlDeclaration = getProjectArtifactDownloadUrlDeclaration;
export const retrieveProjectArtifactDeclaration = getProjectArtifactDownloadUrlDeclaration;
export const getProjectDeclaration = lookupProjectRecordDeclaration;
export const getProjectDetailsDeclaration = lookupProjectRecordDeclaration;
export const getProjectsFromSenderDeclaration = getProjectsFromEmailSenderDeclaration;
export const lookupProjectsByEmailSenderDeclaration = getProjectsFromEmailSenderDeclaration;
export const moveEmailToProjectDeclaration = assignEmailToProjectDeclaration;
export const associateEmailWithProjectDeclaration = assignEmailToProjectDeclaration;
export const listInboxEmailsDeclaration = listUnassignedInboxEmailsDeclaration;

export const allToolDeclarations: FunctionDeclaration[] = [
  updateProjectLifecycleStageDeclaration,
  renameProjectDocumentDeclaration,
  updateProjectBriefDescriptionDeclaration,
  addProjectRequirementTagDeclaration,
  removeProjectRequirementTagDeclaration,
  searchTalentPoolDeclaration,
  indexTalentCvDeclaration,
  readCandidateEmailMessageDeclaration,
  sendCandidateEmailMessageDeclaration,
  saveProjectArtifactDeclaration,
  getProjectArtifactDownloadUrlDeclaration,
  lookupProjectRecordDeclaration,
  listRecentProjectsDeclaration,
  lookupProjectArtifactDeclaration,
  getProjectsFromEmailSenderDeclaration,
  assignEmailToProjectDeclaration,
  listUnassignedInboxEmailsDeclaration,
];



