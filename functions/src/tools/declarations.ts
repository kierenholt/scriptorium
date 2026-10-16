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

// Backwards-compatible aliases
export const updateStatusDeclaration = updateProjectLifecycleStageDeclaration;
export const renameProjectDeclaration = renameProjectDocumentDeclaration;
export const updateDescriptionDeclaration = updateProjectBriefDescriptionDeclaration;
export const addTagDeclaration = addProjectRequirementTagDeclaration;
export const removeTagDeclaration = removeProjectRequirementTagDeclaration;
export const searchTalentDeclaration = searchTalentPoolDeclaration;
export const indexTalentProfileDeclaration = indexTalentCvDeclaration;

export const allToolDeclarations: FunctionDeclaration[] = [
  updateProjectLifecycleStageDeclaration,
  renameProjectDocumentDeclaration,
  updateProjectBriefDescriptionDeclaration,
  addProjectRequirementTagDeclaration,
  removeProjectRequirementTagDeclaration,
  searchTalentPoolDeclaration,
  indexTalentCvDeclaration,
];

