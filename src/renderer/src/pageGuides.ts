import type { PageId } from './navigation'

export type PageGuideSection = {
  title: string
  items: string[]
  tone?: 'default' | 'info' | 'warning'
}

export type PageGuide = {
  title: string
  summary: string
  sections: PageGuideSection[]
  shortcuts?: Array<{ keys: string; action: string }>
}

export const PAGE_GUIDES: Record<PageId, PageGuide> = {
  dashboard: {
    title: 'Dashboard Guide',
    summary: 'Use the customizable Dashboard to monitor Docker runtime health, storage, builds, persistent volumes and operational alerts from one workspace.',
    sections: [
      {
        title: 'Customize the dashboard',
        items: [
          'Choose Customize beside Refresh to open the dashboard layout panel.',
          'Show or hide optional widgets such as Recent Builds, Top Volumes, Recent Alerts and Unhealthy Containers.',
          'Use Move Up / Move Down controls for keyboard-accessible reordering.',
          'Widgets can also be reordered directly with drag-and-drop.',
          'Switch between Comfortable and Compact density.',
          'Reset Default Layout restores the product default order, visibility and density.'
        ]
      },
      {
        title: 'Persistence',
        items: [
          'Dashboard layout is persisted through the typed preferences IPC into SQLite as a versioned UI preference.',
          'New widgets are automatically added when an older saved layout is normalized.',
          'Runtime Summary is essential and cannot be hidden.',
          'A missing or invalid saved layout falls back to safe defaults.'
        ]
      },
      {
        title: 'Operational widgets',
        items: [
          'Storage Chart compares allocated and reclaimable Docker storage.',
          'Container States summarizes running, stopped and unhealthy containers.',
          'Unhealthy Containers links directly to the selected container diagnostics Advisor.',
          'Recent Builds surfaces current Buildx history status.',
          'Top Volumes highlights largest persistent volumes together with risk assessment.',
          'Recent Alerts surfaces warning and critical Operational Intelligence notifications.',
          'Quick Actions navigate to Containers, Compose, Cleanup Advisor and Storage Trends.'
        ]
      },
      {
        title: 'Recommended workflow',
        items: [
          'If Build Cache dominates reclaimable space, open BuildKit first.',
          'If a large Volume also has High or Critical risk, inspect Volume Intelligence before cleanup.',
          'If Docker allocation drops but VHDX remains large, compare Storage Trends before considering compaction.',
          'Use Recent Alerts and Unhealthy Containers before changing runtime resources.'
        ]
      },
      {
        title: 'Safety',
        tone: 'info',
        items: [
          'Dashboard widgets are read-only summaries and navigation shortcuts.',
          'Hiding a widget only changes the UI and never disables monitoring or deletes data.',
          'Cleanup and compaction actions remain in their dedicated pages with separate confirmation.'
        ]
      }
    ],
    shortcuts: [
      { keys: 'Ctrl + K', action: 'Open Command Palette' },
      { keys: 'Esc', action: 'Close Customize or Guide dialogs' }
    ]
  },

  notifications: {
    title: 'Notifications Guide',
    summary: 'Operational Intelligence reports meaningful Docker health and storage changes while keeping monitoring actions read-only.',
    sections: [
      {
        title: 'What appears here',
        items: [
          'Docker Engine connectivity changes.',
          'Containers becoming unhealthy.',
          'Unexpected container exits and possible restart loops.',
          'VHDX or reclaimable Build Cache crossing configured thresholds.'
        ]
      },
      {
        title: 'How to use it',
        items: [
          'Filter by severity or search notification text.',
          'Open the suggested resource action when one is available.',
          'Mark reviewed notifications as read.',
          'Adjust monitoring thresholds in Settings when alerts are too noisy or too quiet.'
        ]
      },
      {
        title: 'Important behavior',
        tone: 'info',
        items: [
          'Monitoring never deletes Docker resources.',
          'Native Windows notifications can be disabled independently from background monitoring.'
        ]
      }
    ]
  },

  activity: {
    title: 'Docker Activity Guide',
    summary: 'The Activity page streams Docker daemon events so you can see resource lifecycle changes in real time.',
    sections: [
      {
        title: 'Use this page for',
        items: [
          'Watching container start, stop, die, restart, health, and destroy events.',
          'Tracking image, network, volume, and daemon activity.',
          'Correlating a runtime issue with events occurring at the same time.'
        ]
      },
      {
        title: 'Working with the stream',
        items: [
          'Filter by Docker event type.',
          'Search the current event buffer by action, resource name, image, or ID.',
          'Use pagination to inspect older buffered events.',
          'Clear the local event view without changing Docker.'
        ]
      },
      {
        title: 'Limits',
        tone: 'info',
        items: [
          'The view keeps a bounded recent event history to protect Renderer memory.',
          'Leaving the page stops its active Docker event stream.'
        ]
      }
    ],
    shortcuts: [{ keys: 'Esc', action: 'Stop the active event stream when supported' }]
  },


  tasks: {
    title: 'Operation Task Center Guide',
    summary: 'Run and monitor long Docker operations without tying their lifetime to one page. Task Center owns process execution in Electron Main and keeps bounded output plus persistent history.',
    sections: [
      {
        title: 'Supported operations',
        items: [
          'Image Pull downloads a Docker image reference.',
          'Compose Pull downloads service images for a selected Compose project.',
          'Compose Build runs a project build with optional no-cache behavior.',
          'Compose Up starts a project and can optionally build first.',
          'BuildKit Prune removes unused Build Cache with optional all/keep-storage settings.',
          'Smart Cleanup executes only the target-generated cleanup steps selected by Cleanup Planner; legacy Safe/Balanced tasks remain readable in history.',
          'VHDX Compact runs the existing disruptive Docker Desktop/WSL compaction workflow.'
        ]
      },
      {
        title: 'Task states',
        items: [
          'Queued means the task has been accepted but has not started.',
          'Running means Electron Main owns an active operation.',
          'Completed means the operation exited successfully.',
          'Failed means the command/action returned an error or non-zero exit code.',
          'Cancelled means a cancellable task was explicitly stopped.'
        ]
      },
      {
        title: 'Live operation data',
        items: [
          'Output is streamed to Task Center while the operation runs.',
          'Known percentage output is reflected in the progress bar when available.',
          'Docker operations without reliable percentage data use an indeterminate progress state plus the latest progress text.',
          'Output is bounded so long-running commands cannot grow Renderer/Main memory without limit.'
        ]
      },
      {
        title: 'Cancellation',
        items: [
          'Docker CLI tasks can be cancelled from the task row or detail panel.',
          'Cancellation terminates the child process owned by Electron Main.',
          'VHDX compaction is not cancellable because interruption during its multi-step Windows/WSL workflow could leave an unclear operational state.'
        ]
      },
      {
        title: 'Persistence',
        items: [
          'Task history is stored locally in the application user-data directory.',
          'Reloading or navigating away from Task Center does not stop a running Main-process task.',
          'If the application itself restarts while a task is running, the persisted task is marked failed/interrupted because the original child process cannot be safely reattached.'
        ]
      },
      {
        title: 'Security model',
        tone: 'warning',
        items: [
          'Task Center does not accept arbitrary shell commands.',
          'Renderer submits an allowlisted operation type and validated parameters; Electron Main constructs the actual command.',
          'Safe Cleanup still excludes volumes.',
          'Destructive or disruptive actions still require their existing confirmation before they are queued from resource pages.'
        ]
      }
    ]
  },

  productivity: {
    title: 'Productivity Guide',
    summary: 'Use Productivity to revisit recent resources and review actions launched through the Command Palette.',
    sections: [
      {
        title: 'Recent resources',
        items: [
          'Resources opened from the Command Palette appear here.',
          'Search recent items and jump back to their page.',
          'Use Favorites in the Command Palette for resources you open frequently.'
        ]
      },
      {
        title: 'Action history',
        items: [
          'Review local quick-action success or failure.',
          'Search by resource name, action title, result, or message.',
          'Clear action history when it is no longer useful.'
        ]
      },
      {
        title: 'Privacy',
        tone: 'info',
        items: [
          'Productivity history is local application state.',
          'It is not intended to store raw secret environment values.'
        ]
      }
    ],
    shortcuts: [
      { keys: 'Ctrl + K', action: 'Open Command Palette' },
      { keys: 'Ctrl + Shift + P', action: 'Open Command Palette' }
    ]
  },

  audit: {
    title: 'Audit & Recovery Guide',
    summary: 'Audit records destructive or cleanup operations and stores recovery metadata that can help explain or recreate deleted resources.',
    sections: [
      {
        title: 'Audit history',
        items: [
          'Search by operation, category, status, command summary, or resource.',
          'Filter success, failure, cleanup, volume, container, and Compose operations.',
          'Export the local audit report when you need an external record.'
        ]
      },
      {
        title: 'Recovery snapshots',
        items: [
          'Open a snapshot to inspect metadata captured before supported destructive operations.',
          'Container snapshots can include image, command, ports, mounts, networks, labels, health, and masked environment metadata.',
          'Volume snapshots contain Docker inspection metadata.'
        ]
      },
      {
        title: 'Diagnostics Bundle Export',
        items: [
          'Export a troubleshooting ZIP directly from Audit & Recovery.',
          'The bundle includes Docker/Compose/container inventories, recent container diagnostics and log tails, BuildKit, Volume Intelligence, Resource Graph, storage, monitoring, Task Center and audit metadata.',
          'Collectors are independent: one failed collector is reported in manifest.json without aborting the rest of the bundle.',
          'Common secret-like keys, tokens, connection strings and credential-bearing URLs are masked before content is written to the ZIP.',
          'The user home-directory prefix is normalized to %USERPROFILE%.'
        ]
      },
      {
        title: 'Sharing safety',
        tone: 'warning',
        items: [
          'Redaction is best-effort; review the ZIP before sending it outside a trusted support channel.',
          'Volume contents and container filesystems are never copied.',
          'Only recent log tails are included and per-container collection is limited to 25 containers.'
        ]
      },
      {
        title: 'Critical limitation',
        tone: 'warning',
        items: [
          'Recovery metadata is not a backup.',
          'Deleted database files, volume contents, object-storage objects, and image layers cannot be reconstructed from metadata alone.'
        ]
      }
    ]
  },

  containers: {
    title: 'Containers Guide',
    summary: 'Manage container lifecycle and open a detailed Runtime & Diagnostics workspace for troubleshooting.',
    sections: [
      {
        title: 'Container list',
        items: [
          'Search or select a container to open its workspace.',
          'Start stopped containers.',
          'Stop running containers gracefully.',
          'Restart when a controlled restart is required.'
        ]
      },
      {
        title: 'Runtime workspace',
        items: [
          'Advisor: evidence-driven analysis of inspect state, health, recent logs, and a point-in-time stats snapshot.',
          'Overview: high-level state, exit code, restart count, OOMKilled state, and inspect metadata.',
          'Logs: live Docker logs with search, regex, pause, and auto-scroll.',
          'Stats: CPU, memory, network, block I/O, and PID information.',
          'Processes: inspect processes with Docker top.',
          'Health: current status and recent health-check output.',
          'Ports, Mounts, Networks, Environment, Files, Inspect, and Terminal provide deeper diagnostics.',
          'Files: browse the running container filesystem, view bounded UTF-8 text, download files, and copy container paths.',
          'Advisor findings separate symptoms, evidence, likely causes, and recommended actions; they do not modify the container.'
        ]
      },
      {
        title: 'AI-assisted Failure Analysis',
        items: [
          'When a container is stopped/failed, unhealthy, repeatedly restarting, OOM-killed, or has an unavailable configured health status, Advisor exposes Analyze failure with AI.',
          'AI uses the same OpenAI-compatible provider configured under Settings → AI Provider.',
          'AI requests are explicit, read-only, redacted in Electron Main, and use bounded recent logs plus Docker inspect/health evidence.',
          'A missing healthcheck is not treated as a health failure; health-unavailable applies only when a healthcheck is configured but Docker reports an unknown/unassessable status.',
          'Local deterministic findings remain visible even when AI is disabled or unavailable.'
        ]
      },
      {
        title: 'Container File Browser',
        items: [
          'Browse with an absolute-path address bar, breadcrumbs, Up, and directory rows.',
          'Regular files can be viewed as UTF-8 text up to a 1 MB preview limit.',
          'Copy Path and Download are read-only operations.',
          'Upload uses a Main-owned system file picker and is limited to regular files up to 100 MB.',
          'Save Text replaces the complete file only after explicit Main-process confirmation.'
        ]
      },
      {
        title: 'Write safeguards',
        tone: 'warning',
        items: [
          'Upload and text save are blocked inside read-only mounts.',
          'Write targets are canonicalized inside the container before mount-risk evaluation so symlinks cannot bypass mount protections.',
          'Writes inside read/write mounts can modify persistent application or database data and are treated as higher risk.',
          'Writes in the container writable layer may disappear when the container is recreated.',
          'Download, upload, and text-write operations are recorded in Audit history.'
        ]
      },
      {
        title: 'Before removing a container',
        tone: 'warning',
        items: [
          'Review Mounts to identify persistent volumes or important bind mounts.',
          'Remember that removing a container is different from removing its attached persistent volume.'
        ]
      }
    ],
    shortcuts: [{ keys: 'Esc', action: 'Stop supported live streams / close overlays' }]
  },

  compose: {
    title: 'Compose Workspace Guide',
    summary: 'Operate Docker Compose projects as a workspace with services, logs, stats, topology, resources, environment, and guarded YAML editing.',
    sections: [
      {
        title: 'Project operations',
        items: [
          'Use Pull, Build, Up, Up + Build, Start, Stop, Restart, and Down from the selected project workspace.',
          'Use service-level controls when only one service needs attention.',
          'Filter Compose services and resource lists with the built-in search controls.'
        ]
      },
      {
        title: 'Diagnostics',
        items: [
          'Logs aggregates selected service logs.',
          'Stats shows runtime resource usage for project containers.',
          'Topology shows service dependencies.',
          'Volumes and Networks expose resolved Compose resources.',
          'Environment masks secret-like values by default.'
        ]
      },
      {
        title: 'Safe Compose editing',
        items: [
          'Edit YAML in Monaco.',
          'Review the diff.',
          'Validate with docker compose config.',
          'The app verifies the source file was not modified externally.',
          'A .dsm.bak backup is created before guarded save.'
        ]
      },
      {
        title: 'Persistent-data safety',
        tone: 'warning',
        items: [
          'Down + Volumes is intentionally not a normal convenience action.',
          'Review named volumes before any operation that may delete persistent data.'
        ]
      }
    ]
  },


  ports: {
    title: 'Port Explorer Guide',
    summary: 'Inspect published Docker ports across standalone containers and Compose services, understand host exposure, open likely HTTP endpoints, and identify active binding conflicts.',
    sections: [
      {
        title: 'Inventory',
        items: [
          'Review host endpoint, container port, protocol, container, image, Compose project/service, and runtime state.',
          'Search by port number, endpoint, container, image, Compose project, service, or exposure type.',
          'Use Protocol, Container State, Exposure, and Conflicts Only filters to narrow the inventory.'
        ]
      },
      {
        title: 'Exposure',
        items: [
          'Loopback bindings such as 127.0.0.1 are intended for local-host access.',
          '0.0.0.0 means the published IPv4 port listens on all host interfaces.',
          ':: represents an all-interface IPv6 binding.',
          'Routed/no-host-port entries are shown separately because Docker may expose a container port without assigning a host port in routed networking modes.'
        ]
      },
      {
        title: 'Conflict detection',
        items: [
          'Conflicts are protocol-aware: TCP and UDP are independent.',
          'A wildcard IPv4 binding overlaps specific IPv4 bindings using the same host port and protocol.',
          'A wildcard IPv6 binding overlaps IPv6 bindings using the same host port and protocol.',
          'Only running container bindings produce a live conflict warning.'
        ]
      },
      {
        title: 'Actions',
        items: [
          'Copy copies the suggested URL when one exists, otherwise the host endpoint.',
          'Open is offered only for likely HTTP(S) TCP ports.',
          'Click a container to open its Ports diagnostics tab.',
          'Click a Compose owner to open the matching Compose workspace.'
        ]
      },
      {
        title: 'Security',
        tone: 'warning',
        items: [
          'Publishing to all interfaces can expose a service beyond localhost depending on Windows firewall and network configuration.',
          'The Open action is validated in Electron Main and accepts only HTTP(S) localhost or literal-IP endpoints.'
        ]
      }
    ]
  },


  'resource-graph': {
    title: 'Resource Dependency Graph Guide',
    summary: 'Explore Docker ownership and runtime dependencies as a topology from Compose projects and services through containers to images, volumes, networks, and published ports.',
    sections: [
      {
        title: 'Relationship model',
        items: [
          'Compose Project → Compose Service uses standard Docker Compose labels.',
          'Compose Service → Container represents the runtime container owned by that service.',
          'Container → Image comes from container inspect image metadata.',
          'Container → Volume comes from inspect Mounts.',
          'Container → Network comes from NetworkSettings.Networks.',
          'Container → Published Port comes from NetworkSettings.Ports.'
        ]
      },
      {
        title: 'Explore the graph',
        items: [
          'Search by container, project, service, image, volume, network, port, resource ID, or metadata value.',
          'Filter to one resource type while retaining directly connected context nodes.',
          'Select a node to inspect incoming and outgoing dependencies.',
          'Enable Focus Selected Neighborhood to isolate the selected resource and its immediate relationships.',
          'Disable Edge Labels when a dense topology needs a cleaner view.'
        ]
      },
      {
        title: 'Shared resources',
        items: [
          'Images, volumes, networks, and host-port nodes with more than one incoming relationship are marked shared.',
          'Shared resources are useful when identifying blast radius before cleanup or configuration changes.',
          'A shared network or image may connect otherwise separate workloads.'
        ]
      },
      {
        title: 'Open resource',
        items: [
          'Compose Project / Service opens its Compose workspace.',
          'Container opens the Container workspace.',
          'Image opens the Images page and launches its Image Intelligence modal.',
          'Volume opens Volume Intelligence.',
          'Network opens Networks.',
          'Port opens Port Explorer.'
        ]
      },
      {
        title: 'Interpretation',
        tone: 'info',
        items: [
          'The graph is a current Docker metadata snapshot, not a historical dependency database.',
          'Edges represent Docker configuration/runtime relationships; they do not prove application-level traffic or data access.',
          'A network edge means the container is attached to the network, not that it communicates with every other attached container.'
        ]
      },
      {
        title: 'Safety',
        tone: 'warning',
        items: [
          'Resource Graph is read-only.',
          'Use the graph to understand blast radius before deleting images, volumes, networks, or containers.',
          'Persistent-volume deletion remains governed by Volume Intelligence safeguards.'
        ]
      }
    ]
  },

  images: {
    title: 'Images & Image Intelligence Guide',
    summary: 'Manage Docker image inventory and open layer-level Image Intelligence in a modal without leaving the Images workspace.',
    sections: [
      {
        title: 'Inventory',
        items: [
          'Search by repository, tag, image ID, age, or size.',
          'Use pagination when the image inventory exceeds ten entries.',
          'Tagged and dangling/untagged counts are summarized above the table.'
        ]
      },
      {
        title: 'Image Intelligence',
        items: [
          'Choose Analyze on any image row to open the Image Intelligence modal.',
          'Review total image size, layer count, largest layer, large-layer count, and optimization recommendations.',
          'Search and paginate Docker image-history layers inside the modal.',
          'Layer rows show history ID, age, size, CreatedBy command, and comment where Docker provides them.',
          'Resource Graph and Command Palette image deep-links now open this same Images page and launch the matching analysis modal.'
        ]
      },
      {
        title: 'Common optimization signals',
        items: [
          'Large package-manager layers may indicate cache cleanup opportunities.',
          'Large dependency layers may benefit from stable Dockerfile ordering and cache separation.',
          '.NET publish or build output layers may benefit from multi-stage builds.',
          'Very large COPY or generated-artifact layers deserve review even when they are valid.'
        ]
      },
      {
        title: 'Cleanup actions',
        items: [
          'Prune dangling removes untagged/dangling image data.',
          'Prune unused can remove all images not referenced by containers.',
          'Remove targets a specific image and remains separate from read-only analysis.'
        ]
      },
      {
        title: 'Interpretation & safety',
        tone: 'warning',
        items: [
          'Image Intelligence recommendations are heuristic and do not rewrite Dockerfiles automatically.',
          'Docker image history metadata is not guaranteed to reproduce the original Dockerfile exactly.',
          'Analysis is read-only; image removal always keeps its own explicit confirmation.',
          'Unused images may still be valuable development/build cache and may need to be downloaded or rebuilt later.'
        ]
      }
    ],
    shortcuts: [
      { keys: 'Esc', action: 'Close the Image Intelligence modal' }
    ]
  },

  buildkit: {
    title: 'BuildKit & Build History Guide',
    summary: 'Inspect Buildx builders, real Buildx history records, and reclaimable BuildKit cache.',
    sections: [
      {
        title: 'Builders',
        items: [
          'Review builder name, driver, status, endpoint, and supported platforms.',
          'Search and paginate builder nodes when multiple instances exist.'
        ]
      },
      {
        title: 'Build History',
        items: [
          'Build ID is extracted from Buildx ref when an explicit ID is absent.',
          'Review status, created/completed time, calculated duration, completed steps, and cached steps.',
          'Search by ID, ref, name, status, timing, or step counts.',
          'Use the status filter to isolate failures.',
          'Select Diagnostics on a build record to open the modal with Overview, Logs, Steps, Cache, Timing, and Error Analysis without leaving BuildKit.'
        ]
      },
      {
        title: 'Build Cache',
        items: [
          'Enable Reclaimable only to focus on removable cache.',
          'Use Open in Docker Desktop from the diagnostics workspace when you need Docker Desktop’s native build record view.',
          'Safe prune removes unused build cache.',
          'Prune all is more aggressive and may cause future builds to rebuild or download layers.'
        ]
      },
      {
        title: 'Build history format',
        tone: 'info',
        items: [
          'The parser supports Docker Desktop snake_case NDJSON as well as alternate Buildx JSON field styles.',
          'Escape closes the Build Diagnostics modal; keyboard focus is trapped while the modal is open and restored after close.'
        ]
      }
    ]
  },

  volumes: {
    title: 'Volume Intelligence Guide',
    summary: 'Understand persistent-data ownership before cleanup by combining Docker volume metadata, container mounts, Compose ownership, workload signatures, size, and conservative deletion risk.',
    sections: [
      {
        title: 'Inventory',
        items: [
          'Review size, creation time, workload classification, ownership, risk score, and deletion assessment.',
          'Search by volume name, workload, container, image, Compose project/service, mount destination, label, or risk.',
          'Use High / Critical Risk and No Current References switches to focus the inventory.'
        ]
      },
      {
        title: 'Ownership & references',
        items: [
          'Container references come from Docker inspect Mounts metadata.',
          'Compose ownership comes from com.docker.compose.project and com.docker.compose.service labels on referencing containers.',
          'Open a container directly in its Mounts tab or jump to the owning Compose workspace.'
        ]
      },
      {
        title: 'Workload detection',
        items: [
          'Known signatures include PostgreSQL, MySQL/MariaDB, SQL Server, MongoDB, Redis, MinIO, and Elasticsearch.',
          'Detection uses image names, Compose/container names, volume labels, volume names, and mount destinations.',
          'High-confidence findings require stronger evidence such as a known container image or standard data mount path.'
        ]
      },
      {
        title: 'Risk model',
        items: [
          'Current container references increase deletion risk substantially.',
          'Detected database/object-storage/search workloads increase risk.',
          'Compose ownership, labels, and large volume size add additional risk signals.',
          'Assessment values are Blocked, High Risk, or Review Required; Volume Intelligence never labels persistent data Safe to Delete.'
        ]
      },
      {
        title: 'Backup guidance',
        items: [
          'Database/storage workload findings include technology-specific backup hints.',
          'A Docker metadata snapshot is not a backup of the volume contents.',
          'Verify a real logical backup, export, replication target, or storage snapshot before deletion.'
        ]
      },
      {
        title: 'Important limitation',
        tone: 'warning',
        items: [
          'No current container reference does not prove the volume is disposable.',
          'The “latest related container” timestamp is relationship metadata, not proof of the last read/write to the volume.',
          'Volume removal remains a typed-confirmation destructive operation.'
        ]
      }
    ]
  },
  networks: {
    title: 'Networks Guide',
    summary: 'Review Docker network inventory and safely remove networks that Docker reports as unused.',
    sections: [
      {
        title: 'Inventory',
        items: [
          'Search by network name, driver, scope, or ID.',
          'Use the list to distinguish local bridge networks from other Docker network types.'
        ]
      },
      {
        title: 'Prune unused',
        items: [
          'Prune requests Docker to remove unused networks.',
          'Active networks attached to containers should not be removed by normal Docker prune semantics.'
        ]
      },
      {
        title: 'Troubleshooting',
        tone: 'info',
        items: [
          'If containers cannot communicate, compare their attached networks in the Container or Compose workspace.',
          'Use Ports for host exposure problems and Networks for service-to-service connectivity problems.'
        ]
      }
    ]
  },

  cleanup: {
    title: 'Smart Cleanup Planner Guide',
    summary: 'Set a reclaim target and let DockScope build the lowest-risk cleanup sequence needed to approach or reach that goal without automatically touching persistent volumes.',
    sections: [
      {
        title: 'Set a target',
        items: [
          'Enter the amount of disk space you want to reclaim in GB or use a preset such as 5, 10, 20, or 50 GB.',
          'Build Plan re-analyzes current Docker reclaimable storage before selecting cleanup categories.',
          'The plan compares Target, Selected Plan, Total Potential, and Headroom or Shortfall.'
        ]
      },
      {
        title: 'Planning order',
        items: [
          'Build Cache is considered first because it is low risk and usually offers meaningful reclaimable space.',
          'Dangling Images are considered next.',
          'Stopped Containers follow as another low-risk cleanup source.',
          'Unused Networks remain visible but are not counted toward the storage target because Docker does not report meaningful reclaimable bytes for them.',
          'All Unused Images are medium risk and are added only when lower-risk categories are insufficient.'
        ]
      },
      {
        title: 'Avoiding double counting',
        items: [
          'Unused Images are calculated as additional image reclaim after the Dangling Images estimate.',
          'This prevents the planner from adding the complete Docker Images reclaimable value twice.',
          'Image estimates remain approximate because Docker images can share layers.'
        ]
      },
      {
        title: 'When the target cannot be reached',
        tone: 'info',
        items: [
          'The planner reports the maximum current cleanup potential and the remaining shortfall.',
          'You can lower the target or execute the available plan.',
          'Large persistent volumes should be investigated separately in Volume Intelligence rather than silently added to the plan.',
          'If logical Docker allocation falls but the host VHDX remains large, review Storage Trends and VHDX compaction separately.'
        ]
      },
      {
        title: 'Execution',
        items: [
          'Only cleanup steps marked Included are queued to Operation Task Center.',
          'If the target is already satisfied by lower-risk categories, broader operations such as image prune --all are not executed.',
          'The confirmation dialog lists selected categories and estimates before the task is queued.',
          'Actual reclaimed space may differ from estimates because of Docker shared layers and changing runtime state.'
        ]
      },
      {
        title: 'Persistent-data boundary',
        tone: 'warning',
        items: [
          'Volumes are never automatically included in a Smart Cleanup plan.',
          'Volume contents may contain databases, uploads, object storage, or application state.',
          'Use Volume Intelligence to review volume ownership, workload type, risk, and backup readiness.'
        ]
      }
    ]
  },
  storage: {
    title: 'Storage Trends & VHDX Guide',
    summary: 'Track Docker storage growth over 24 hours, 7 days, or 30 days and compare Docker-reported allocation with the physical Docker Desktop VHDX footprint.',
    sections: [
      {
        title: 'What is sampled',
        items: [
          'Images allocated bytes and image count.',
          'Container writable-layer bytes and container count.',
          'Local Volume bytes and volume count.',
          'Build Cache bytes and cache-record count.',
          'Total Docker allocation and reclaimable bytes.',
          'Docker Desktop VHDX physical file size when its path is available.',
          'Host drive free space for the drive containing the detected VHDX.'
        ]
      },
      {
        title: 'Sampling & retention',
        items: [
          'A sample is attempted at startup and approximately every 15 minutes while DockScope remains running.',
          'Scheduled samples are de-duplicated when the previous sample is too recent.',
          'History is retained locally for about 31 days with a hard cap of 3,100 samples.',
          'Record Sample Now captures an explicit baseline or post-cleanup measurement.'
        ]
      },
      {
        title: 'Ranges',
        items: [
          '24 hours is useful for debugging sudden storage growth.',
          '7 days is useful for development/build-cache patterns.',
          '30 days is useful for longer-term Docker Desktop growth.',
          'Summary delta compares the first and latest sample inside the selected range.'
        ]
      },
      {
        title: 'Docker allocation vs VHDX',
        items: [
          'Docker allocation is calculated from Images, Containers, Local Volumes and Build Cache reported by Docker.',
          'VHDX size is the physical Docker Desktop virtual-disk file size on Windows.',
          'Docker cleanup can reduce logical allocation without immediately shrinking the VHDX file.',
          'VHDX compaction is therefore a separate, disruptive operation after Docker cleanup.'
        ]
      },
      {
        title: 'Interpretation',
        tone: 'info',
        items: [
          'A growing Volume line can indicate persistent application/database growth and should be reviewed in Volume Intelligence.',
          'A growing Build Cache line can often be reclaimed but may increase future build time.',
          'A growing Images line may reflect frequent tag/build activity.',
          'Historical points are local snapshots, not external telemetry.'
        ]
      },
      {
        title: 'Safety',
        tone: 'warning',
        items: [
          'Sampling is read-only and does not prune or modify Docker resources.',
          'Storage history contains aggregate sizes/counts only; it does not copy volume contents.',
          'VHDX compaction retains its typed confirmation and Task Center safeguards.'
        ]
      }
    ]
  },
  settings: {
    title: 'Settings & Profiles Guide',
    summary: 'Configure application-wide Docker, monitoring, cleanup, terminal, notification, storage, security, and Windows behavior.',
    sections: [
      {
        title: 'Profiles',
        items: [
          'Development: balanced defaults for normal local work.',
          'Conservative: safer behavior and more retained cache.',
          'CI / Build Heavy: higher thresholds and larger build/log retention.',
          'Low Disk Space: earlier storage warnings and more aggressive non-volume cleanup defaults.',
          'Custom: activated automatically after manual changes.'
        ]
      },
      {
        title: 'Sections',
        items: [
          'General: theme, Windows startup, tray, and minimized launch.',
          'Docker: CLI path, context, and command timeout.',
          'Monitoring: polling and alert thresholds.',
          'Cleanup: default cleanup policy and Build Cache retention.',
          'Terminal & Logs: shell and log/stat defaults.',
          'Notifications: native Windows notification policy.',
          'Storage: VHDX path and compaction preferences.',
          'Security: secret masking, critical confirmations, force-remove policy, and retention.'
        ]
      },
      {
        title: 'Applying changes',
        items: [
          'Unsaved changes are marked in the page header.',
          'Save & Apply updates the central Settings service.',
          'Changing a profile value switches the active profile to Custom.'
        ]
      },
      {
        title: 'Safety defaults',
        tone: 'warning',
        items: [
          'No profile enables automatic volume deletion.',
          'Secret masking and typed confirmation for critical actions should normally remain enabled.'
        ]
      }
    ]
  },
  about: {
    title: 'About & Updates Guide',
    summary: 'Review the current application/runtime versions, release notes, release channel, and the guarded desktop update lifecycle.',
    sections: [
      {
        title: 'Runtime versions',
        items: [
          'Current application version comes from Electron app.getVersion().',
          'Electron, Node.js and Chromium versions come from the running packaged runtime.',
          'Docker Engine, Docker Compose and Docker Context are queried from the active Docker environment.'
        ]
      },
      {
        title: 'Release channels',
        items: [
          'Stable maps to the latest update channel and receives production releases.',
          'Preview maps to the beta channel and can receive beta releases as well as newer stable releases.',
          'The selected channel is persisted in SQLite and restored on the next launch.',
          'Changing channel clears the previous candidate so the next check is evaluated against the newly selected channel.'
        ]
      },
      {
        title: 'Update lifecycle',
        items: [
          'Check for updates only queries the configured release feed; automatic download is disabled.',
          'Download Update starts only after an update candidate is available and reports transferred bytes, speed and percent.',
          'Install & Restart is enabled only after electron-updater reports update-downloaded.',
          'The user must explicitly confirm Install & Restart.'
        ]
      },
      {
        title: 'Release source',
        tone: 'info',
        items: [
          'Production builds require DSM_UPDATE_BASE_URL or a populated build/update-config.json.',
          'The release server must publish electron-builder update metadata and matching installer artifacts.',
          'Current release notes are bundled with the application; available-release notes come from updater metadata.'
        ]
      },
      {
        title: 'Packaging constraints',
        tone: 'warning',
        items: [
          'Windows self-update is supported for the installed NSIS target.',
          'Portable builds are identified and do not offer self-install.',
          'Development builds intentionally disable update check/download/install.',
          'Do not mix update metadata and installer artifacts from different builds because checksum validation will fail.'
        ]
      },
      {
        title: 'Security boundary',
        tone: 'warning',
        items: [
          'Renderer cannot configure arbitrary updater internals or execute installers directly.',
          'Release channel is validated in Main to Stable or Preview.',
          'Feed selection, update download and quitAndInstall remain in Electron Main.'
        ]
      }
    ]
  }
}
