const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  FORMATEUR: 'FORMATEUR',
  FORMATEUR_SIMPLE: 'FORMATEUR_SIMPLE',
  ETUDIANT: 'ETUDIANT'
};

const NIVEAU = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  M1: 'M1',
  M2: 'M2'
};

const RESOURCE_CATEGORIES = {
  COURS: 'Cours',
  TD: 'TD',
  TP: 'TP',
  EXAMEN: 'Examen'
};

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
  INTERNAL_SERVER_ERROR: 500
};

const FILE_TYPES = {
  PDF: 'application/pdf',
  PPT: 'application/vnd.ms-powerpoint',
  PPTX: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};

const ALLOWED_EXTENSIONS = ['.pdf', '.ppt', '.pptx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

module.exports = {
  ROLES,
  NIVEAU,
  RESOURCE_CATEGORIES,
  HTTP_STATUS,
  FILE_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE
};
