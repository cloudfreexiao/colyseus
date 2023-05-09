#!/usr/bin/env node

const os = require('os');
const fs = require('fs');
const { exec } = require('child_process');

const NGINX_LIMITS_CONFIG_FILE = '/etc/nginx/colyseus_limits.conf';
const LIMITS_CONF_FILE = "/etc/security/limits.conf";

// update file descriptor limits systemwide + nginx worker connections

function bailOnErr(err) {
  if (err) {
    console.error(err);

    // exit with error!
    process.exit(1);
  }
}

function updateNOFileConfig(cb) {
  // const numCPU = os.cpus().length;
  const totalmemMB = os.totalmem() / 1024 / 1024;
  const estimatedCCUPerGB = 4000;

  const maxCCU = (totalmemMB / 1024) * estimatedCCUPerGB;
  const systemMaxNOFileLimit = maxCCU * 4;
  const nginxMaxNOFileLimit = maxCCU * 3; // 3x because of nginx -> proxy_pass -> node:port

  // immediatelly apply new nofile limit
  exec(`ulimit -n ${systemMaxNOFileLimit}`, bailOnErr);

  // update "/etc/security/limits.conf" file.
  fs.writeFileSync(LIMITS_CONF_FILE, `
* - nofile $NOFILE_LIMIT
`, bailOnErr);

  if (fs.existsSync(NGINX_LIMITS_CONFIG_FILE)) {
    fs.writeFileSync(NGINX_LIMITS_CONFIG_FILE, `
worker_rlimit_nofile ${nginxMaxNOFileLimit};

events {
    worker_connections ${maxCCU};
    # multi_accept on;
}
`, cb);
    console.log("new nofile limit:", { maxCCU, systemMaxNOFileLimit, nginxMaxNOFileLimit });

  } else {
    console.warn(NGINX_LIMITS_CONFIG_FILE, "not found.");
  }
}


updateNOFileConfig(bailOnErr);