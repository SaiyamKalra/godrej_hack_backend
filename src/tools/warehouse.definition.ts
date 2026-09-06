export const getRecentAlertsDefinition = {
  type: "function",
  function: {
    name: "get_recent_alerts",
    description: "Get recent safety violation alerts from warehouse cameras",
    parameters: {
      type: "object",
      properties: {
        cameraId: {
          type: "string",
          description: "Optional ID of a specific camera",
        },
        className: {
          type: "string",
          description: "Optional class of violation (e.g. no_helmet, forklift_unsafe)",
        },
        severity: {
          type: "string",
          enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
          description: "Optional severity level",
        },
        limit: {
          type: "integer",
          description: "Number of alerts to return (default 10)",
        }
      },
      required: [],
    },
  },
};

export const getAlertStatsDefinition = {
  type: "function",
  function: {
    name: "get_alert_stats",
    description: "Get aggregated alert statistics (by severity, class, and unacknowledged counts)",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const getCamerasDefinition = {
  type: "function",
  function: {
    name: "get_cameras",
    description: "Get list of all configured warehouse cameras",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
};

export const getArchiveClipsDefinition = {
  type: "function",
  function: {
    name: "get_archive_clips",
    description: "Get list of recently saved incident video clips",
    parameters: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of clips to return (default 5)",
        }
      },
      required: [],
    },
  },
};
