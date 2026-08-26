const args = process.argv.slice(2)
const scenario = process.env.DSM_MOCK_SCENARIO ?? 'success'
const advisorScenario = process.env.DSM_MOCK_ADVISOR ?? 'healthy'
const key = args.join(' ')

function tarEntry(name, type = '0', content = '') {
  const body = Buffer.from(content)
  const header = Buffer.alloc(512)
  Buffer.from(name).copy(header, 0)
  Buffer.from('0000644\0').copy(header, 100)
  Buffer.from('0000000\0').copy(header, 108)
  Buffer.from('0000000\0').copy(header, 116)
  Buffer.from(body.length.toString(8).padStart(11, '0') + '\0').copy(header, 124)
  Buffer.from('15100000000\0').copy(header, 136)
  header[156] = type.charCodeAt(0)
  Buffer.from('ustar\0').copy(header, 257)
  const checksum = Array.from(header).reduce((sum, byte) => sum + byte, 0)
  Buffer.from(checksum.toString(8).padStart(6, '0') + '\0 ').copy(header, 148)
  const padding = Buffer.alloc((512 - (body.length % 512)) % 512)
  return Buffer.concat([header, body, padding])
}

if (scenario === 'timeout') {
  setTimeout(() => process.exit(0), 60_000)
} else if (scenario === 'daemon-down') {
  console.error('Cannot connect to the Docker daemon at npipe:////./pipe/docker_engine.')
  process.exit(1)
} else if (scenario === 'failure') {
  console.error(`mock failure: docker ${key}`)
  process.exit(42)
} else if (key === 'version --format {{.Server.Version}}') {
  console.log('29.6.1')
} else if (key === 'compose version --short') {
  console.log('2.39.1')
} else if (key === 'context show') {
  console.log('desktop-linux')
} else if (key === 'system df --format json') {
  console.log(JSON.stringify({Type:'Images',TotalCount:'8',Active:'3',Size:'12.4GB',Reclaimable:'5.1GB (41%)'}))
  console.log(JSON.stringify({Type:'Containers',TotalCount:'6',Active:'2',Size:'1.2GB',Reclaimable:'800MB (66%)'}))
  console.log(JSON.stringify({Type:'Local Volumes',TotalCount:'5',Active:'4',Size:'7.5GB',Reclaimable:'1.0GB (13%)'}))
  console.log(JSON.stringify({Type:'Build Cache',TotalCount:'24',Active:'0',Size:'9.1GB',Reclaimable:'9.1GB'}))
} else if (key === 'volume ls --format {{json .}}') {
  console.log(JSON.stringify({Name:'db-data',Driver:'local',Scope:'local'}))
  console.log(JSON.stringify({Name:'uploads',Driver:'local',Scope:'local'}))
} else if (key === 'system df -v') {
  console.log(`Images space usage:

REPOSITORY   TAG      IMAGE ID       CREATED        SIZE     SHARED SIZE   UNIQUE SIZE   CONTAINERS
postgres     18       sha256:img1    2 weeks ago    450MB    0B            450MB         1

Containers space usage:

CONTAINER ID   IMAGE          COMMAND   LOCAL VOLUMES   SIZE   CREATED       STATUS    NAMES
abc123         my-api:latest  "app"     1               10MB   3 minutes ago Up        api

Local Volumes space usage:

NAME       LINKS   SIZE
db-data    1       2.45GB
uploads    0       128.5MB

Build cache usage: 9.1GB`)
} else if (key === 'volume inspect db-data uploads') {
  console.log(JSON.stringify([
    {
      Name:'db-data',Driver:'local',Scope:'local',CreatedAt:'2026-08-01T10:15:00Z',
      Mountpoint:'/var/lib/docker/volumes/db-data/_data',
      Labels:{'com.docker.compose.project':'sample','com.example.purpose':'database'},
      Options:{}
    },
    {
      Name:'uploads',Driver:'local',Scope:'local',CreatedAt:'2026-08-10T09:30:00Z',
      Mountpoint:'/var/lib/docker/volumes/uploads/_data',
      Labels:{'com.example.purpose':'uploads'},
      Options:{}
    }
  ]))
} else if (key === 'container ls -a --filter volume=db-data -q') {
  console.log('abc123')
} else if (key === 'container ls -a --filter volume=uploads -q') {
  // unused
} else if (key.includes('container ls') && key.includes('--format json')) {
  console.log(JSON.stringify({ID:'abc123',Names:'api',Image:'my-api:latest',State:'running',Status:'Up 3 minutes (healthy)',Ports:'0.0.0.0:8080->8080/tcp',Size:'10MB'}))
  console.log(JSON.stringify({ID:'def456',Names:'worker',Image:'worker:latest',State:'exited',Status:'Exited (0) 2 hours ago',Ports:'',Size:'4MB'}))
} else if (key === 'image pull postgres:18') {
  console.log('18: Pulling from library/postgres')
  console.log('layer-a: Downloading 42%')
  console.log('layer-a: Pull complete')
  console.log('Digest: sha256:mock-postgres')
} else if (key === 'builder prune --force') {
  console.log('ID          RECLAIMABLE   SIZE')
  console.log('cache-a     true          512MB')
  console.log('Total: 512MB')
} else if (key === 'cp abc123:/ -') {
  process.stdout.write(Buffer.concat([
    tarEntry('bin/', '5'),
    tarEntry('tmp/', '5'),
    tarEntry('tmp/clr-debug-pipe-1-702242-in', '6'),
    tarEntry('hello.txt', '0', 'hello'),
    Buffer.alloc(1024)
  ]))
} else if (key === 'buildx history ls --format json') {
  console.log(JSON.stringify({
    cached_steps:11,
    completed_at:'2026-08-18T13:22:30.660105162Z',
    completed_steps:19,
    created_at:'2026-08-18T13:22:29.733581777Z',
    name:'',
    ref:'desktop-linux/desktop-linux/vh50t5y5k6dlcmj0bnwi2tc4r',
    status:'Completed',
    total_steps:19
  }))
  console.log(JSON.stringify({
    cached_steps:1,
    completed_at:'2026-08-02T14:13:39.820855884Z',
    completed_steps:9,
    created_at:'2026-08-02T14:13:31.854005277Z',
    name:'demo-client',
    ref:'desktop-linux/desktop-linux/bjg3aqtclgtkp115v4nbri1dv',
    status:'Error',
    total_steps:15
  }))
  console.log(JSON.stringify({
    cached_steps:36,
    completed_at:'2026-08-02T14:14:31.079258139Z',
    completed_steps:44,
    created_at:'2026-08-02T14:14:30.222507191Z',
    name:'src/BetisaAi.Gateway.Api',
    ref:'desktop-linux/desktop-linux/sdir185997plul6wy5ononc3j',
    status:'Completed',
    total_steps:44
  }))
} else if (key === 'buildx history inspect --format json vh50t5y5k6dlcmj0bnwi2tc4r') {
  console.log(JSON.stringify({
    Name:'',Ref:'vh50t5y5k6dlcmj0bnwi2tc4r',Context:'.',Dockerfile:'Dockerfile',
    VCSRepository:'https://github.com/example/api.git',VCSRevision:'abc123',Target:'runtime',
    Platform:['linux/amd64'],StartedAt:'2026-08-18T13:22:29.733581777Z',CompletedAt:'2026-08-18T13:22:30.660105162Z',
    Duration:926523385,Status:'completed',NumCompletedSteps:19,NumTotalSteps:19,NumCachedSteps:11,
    Config:{ImageResolveMode:'local'},Materials:[{URI:'pkg:docker/node@22-alpine',Digests:['sha256:node']}],
    Attachments:[{Digest:'sha256:prov',Platform:'linux/amd64',Type:'https://slsa.dev/provenance/v0.2'}]
  }))
} else if (key === 'buildx history logs --progress plain vh50t5y5k6dlcmj0bnwi2tc4r') {
  console.log(`#1 [internal] load build definition from Dockerfile\n#1 DONE 0.1s\n#2 [internal] load metadata for docker.io/library/node:22-alpine\n#2 CACHED\n#3 [build 1/3] RUN npm ci\n#3 npm ERR! code ENOTFOUND\n#3 npm ERR! network request failed\n#3 ERROR: process \"/bin/sh -c npm ci\" did not complete successfully: exit code: 1`)
} else if (key === 'buildx history open vh50t5y5k6dlcmj0bnwi2tc4r') {
  console.log('Opened build in Docker Desktop')
} else if (key === 'image ls --filter dangling=true --format json') {
  console.log(JSON.stringify({ID:'sha256:dangling1',Repository:'<none>',Tag:'<none>',Size:'1.4GB',CreatedSince:'5 days ago'}))
} else if (key.startsWith('image ls')) {
  console.log(JSON.stringify({ID:'sha256:img1',Repository:'postgres',Tag:'18',Size:'450MB',CreatedSince:'2 weeks ago'}))
} else if (key === 'compose ls --all --format json') {
  console.log(JSON.stringify([{Name:'sample',Status:'running(2)',ConfigFiles:'C:\\\\repo\\\\compose.yaml'}]))
} else if (key === 'compose -p sample -f C:\\repo\\compose.yaml ps --all --no-trunc --format json') {
  console.log(JSON.stringify({ID:'abc123',Name:'sample-api-1',Service:'api',Image:'my-api:latest',State:'running',Health:'healthy',ExitCode:0,Publishers:[]}))
  console.log(JSON.stringify({ID:'def456',Name:'sample-worker-1',Service:'worker',Image:'worker:latest',State:'exited',Health:'',ExitCode:0,Publishers:[]}))
} else if (key === 'stats --no-stream --format json abc123') {
  console.log(JSON.stringify({Name:'api',CPUPerc:'12.50%',MemUsage:'450MiB / 1GiB',MemPerc:'43.95%',NetIO:'10MB / 4MB',BlockIO:'2MB / 1MB',PIDs:'18'}))
} else if (key === 'container logs --timestamps --tail 400 abc123') {
  if (advisorScenario === 'oom') console.log('2026-08-21T12:00:00Z worker terminated unexpectedly')
  else if (advisorScenario === 'network') console.log('2026-08-21T12:00:00Z ERROR connect ECONNREFUSED redis:6379')
  else console.log('2026-08-21T12:00:00Z info request completed')
} else if (key.startsWith('container logs')) {
  console.log('2026-08-21T12:00:00Z info request completed')
} else if (key === 'container inspect abc123 def456') {
  console.log(JSON.stringify([
    {
      Id:'abc123',
      Name:'/api',
      Image:'sha256:shared-app',
      Platform:'linux',
      Created:'2026-08-21T10:00:00Z',
      RestartCount:0,
      Config:{
        Image:'my-api:latest',
        Labels:{
          'com.docker.compose.project':'sample',
          'com.docker.compose.service':'api'
        }
      },
      State:{Status:'running',Running:true,StartedAt:'2026-08-21T11:00:00Z',Health:{Status:'healthy'}},
      Mounts:[
        {Type:'volume',Name:'db-data',Source:'/var/lib/docker/volumes/db-data/_data',Destination:'/var/lib/postgresql/data',Driver:'local',Mode:'rw',RW:true,Propagation:''}
      ],
      NetworkSettings:{
        Networks:{
          sample_default:{NetworkID:'net-shared',IPAddress:'172.20.0.2',Gateway:'172.20.0.1',GlobalIPv6Address:'',MacAddress:'02:42:ac:14:00:02'}
        },
        Ports:{
          '8080/tcp':[{HostIp:'0.0.0.0',HostPort:'8080'}],
          '8443/tcp':[{HostIp:'127.0.0.1',HostPort:'8443'}],
          '53/udp':[{HostIp:'0.0.0.0',HostPort:'5353'}]
        }
      }
    },
    {
      Id:'def456',
      Name:'/worker',
      Image:'sha256:shared-app',
      Platform:'linux',
      Created:'2026-08-20T09:00:00Z',
      RestartCount:0,
      Config:{
        Image:'worker:latest',
        Labels:{
          'com.docker.compose.project':'sample',
          'com.docker.compose.service':'worker'
        }
      },
      State:{Status:'running',Running:true,StartedAt:'2026-08-20T10:00:00Z'},
      Mounts:[],
      NetworkSettings:{
        Networks:{
          sample_default:{NetworkID:'net-shared',IPAddress:'172.20.0.3',Gateway:'172.20.0.1',GlobalIPv6Address:'',MacAddress:'02:42:ac:14:00:03'}
        },
        Ports:{
          '9090/tcp':[{HostIp:'127.0.0.1',HostPort:'8080'}],
          '6379/tcp':null
        }
      }
    }
  ]))
} else if (key.startsWith('container inspect')) {
  if (advisorScenario === 'oom') {
    console.log(JSON.stringify([{Id:'abc123',Name:'/api',Platform:'linux',Created:'2026-08-21T10:00:00Z',RestartCount:7,State:{Status:'exited',Running:false,ExitCode:137,OOMKilled:true,StartedAt:'2026-08-21T11:59:00Z',FinishedAt:'2026-08-21T12:00:00Z',Error:'',Health:{Status:'unhealthy',FailingStreak:3,Log:[{Start:'2026-08-21T11:59:50Z',End:'2026-08-21T11:59:51Z',ExitCode:1,Output:'health endpoint timed out'}]}},Config:{Image:'my-api:latest',Cmd:['dotnet','Api.dll'],Entrypoint:[],WorkingDir:'/app',Env:['PASSWORD=secret','MODE=Development'],Healthcheck:{Test:['CMD','curl','-f','http://localhost:8080/health'],Interval:30000000000,Timeout:5000000000,Retries:3},Labels:{}},HostConfig:{RestartPolicy:{Name:'unless-stopped'}},NetworkSettings:{Ports:{'8080/tcp':[{HostIp:'0.0.0.0',HostPort:'8080'}]},Networks:{bridge:{IPAddress:'172.17.0.2',Gateway:'172.17.0.1',MacAddress:'02:42:ac:11:00:02',Aliases:['api']}}},Mounts:[]}]))
  } else {
    console.log(JSON.stringify([{Id:'abc123',Name:'/api',Platform:'linux',Created:'2026-08-21T10:00:00Z',RestartCount:0,State:{Status:'running',Running:true,ExitCode:0,OOMKilled:false,StartedAt:'2026-08-21T11:00:00Z',FinishedAt:'0001-01-01T00:00:00Z',Error:'',Health:{Status:'healthy',FailingStreak:0,Log:[]}},Config:{Image:'my-api:latest',Cmd:['dotnet','Api.dll'],Entrypoint:[],WorkingDir:'/app',Env:['PASSWORD=secret','MODE=Development'],Healthcheck:{Test:['CMD','curl','-f','http://localhost:8080/health'],Interval:30000000000,Timeout:5000000000,Retries:3},Labels:{}},HostConfig:{RestartPolicy:{Name:'unless-stopped'}},NetworkSettings:{Ports:{'8080/tcp':[{HostIp:'0.0.0.0',HostPort:'8080'}]},Networks:{bridge:{IPAddress:'172.17.0.2',Gateway:'172.17.0.1',MacAddress:'02:42:ac:11:00:02',Aliases:['api']}}},Mounts:[]}]))
  }
} else if (key.startsWith('volume inspect')) {
  console.log(JSON.stringify([{Name:'db-data',Driver:'local',Mountpoint:'/var/lib/docker/volumes/db-data/_data'}]))
} else {
  console.log(`mock docker ${key}`)
}
