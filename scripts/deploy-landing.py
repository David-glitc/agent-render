#!/usr/bin/env python3
"""Deploy the static launch site with an expiring token and revoke it afterward."""
import datetime
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'landing'
PROJECT = 'agent-render'
DOMAIN = 'agent-render.kierkegaard.space'
ZONE = '7c72ed4de250b9558c48355bf5d3a298'


def main():
    for name in ['index.html', 'style.css', 'site.js', 'demo.png', 'social.png', 'launch.mp4', 'launch-poster.jpg', 'launch.vtt']:
        if not (SITE / 'public' / name).is_file():
            raise SystemExit('Missing public asset: ' + name)
    values = {}
    credentials_path = Path(os.environ.get('CF_CREDENTIALS_FILE', str(Path.home() / 'cf.creds')))
    for line in credentials_path.read_text().splitlines():
        match = re.match(r'^\s*(?:export\s+)?([\w]+)\s*=\s*(.*?)\s*$', line)
        if match:
            values[match[1]] = match[2].strip('\"\'')
    account = values.get('CLOUDFLARE_ACCOUNT_ID') or values.get('VPS_ACCOUNT_ID') or values.get('VPS_ACOUNT_ID')
    parent = values.get('API_MANAGEMENT')
    if not account or not parent:
        raise SystemExit('Missing account ID or API_MANAGEMENT in authorized credentials file')
    secrets = [parent]
    base_env = os.environ | {'CLOUDFLARE_ACCOUNT_ID': account, 'NODE_OPTIONS': '--dns-result-order=ipv4first', 'WRANGLER_SEND_METRICS': 'false', 'WRANGLER_LOG_SANITIZE': 'true'}
    parent_env = base_env | {'CLOUDFLARE_API_TOKEN': parent}
    checks = SITE / 'checks'
    checks.mkdir(exist_ok=True)

    def redact(value):
        for secret in secrets:
            value = value.replace(secret, '[redacted]')
        return value

    def run(args, env, check=True):
        result = subprocess.run(args, cwd=SITE, env=env, capture_output=True, text=True)
        if check and result.returncode:
            raise RuntimeError(redact(result.stdout + result.stderr))
        return result

    def data(result):
        value = json.loads(result.stdout)
        return value.get('result', value) if isinstance(value, dict) else value

    token = None
    receipt = {'project': PROJECT, 'domain': DOMAIN}
    try:
        policies = [
            {'effect': 'allow', 'resources': {'com.cloudflare.api.account.' + account: '*'}, 'permission_groups': [{'id': '8d28297797f24fb8a0c332fe0866ec89'}]},
            {'effect': 'allow', 'resources': {'com.cloudflare.api.account.zone.' + ZONE: '*'}, 'permission_groups': [{'id': '4755a26eedb94da69e1066d98aa820be'}, {'id': 'c8fed203ed3043cba015a93ad1616f1f'}]},
        ]
        expires = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
        with tempfile.TemporaryDirectory(prefix='agent-render-token-') as temp:
            policy_file = Path(temp) / 'policies.json'
            policy_file.write_text(json.dumps(policies))
            policy_file.chmod(0o600)
            token = data(run(['cf', 'user', 'tokens', 'create', '--name', 'agent-render-deploy', '--expires-on', expires, '--policies', '@' + str(policy_file)], parent_env))
        secrets.append(token['value'])
        env = base_env | {'CLOUDFLARE_API_TOKEN': token['value']}
        existing_dns = data(run(['cf', 'dns', 'records', 'list', '--zone', ZONE, '--name', DOMAIN], env))
        existing_project = run(['cf', 'pages', 'get', PROJECT], env, check=False)
        if existing_project.returncode:
            if not any(code in existing_project.stdout + existing_project.stderr for code in ['404', '8000007']):
                raise RuntimeError(redact(existing_project.stdout + existing_project.stderr))
            if existing_dns:
                raise RuntimeError('Requested hostname already has DNS records; refusing to replace an unrelated service.')
            body = json.dumps({'name': PROJECT, 'production_branch': 'main', 'deployment_configs': {'production': {'compatibility_date': '2026-10-13'}, 'preview': {'compatibility_date': '2026-10-13'}}})
            run(['cf', 'pages', 'create', '--body', body, '--dry-run'], env)
            project = data(run(['cf', 'pages', 'create', '--body', body], env))
        else:
            project = data(existing_project)
        pages_host = project['subdomain']
        if any(record['type'] != 'CNAME' or record['content'].rstrip('.') != pages_host for record in existing_dns):
            raise RuntimeError('Hostname belongs to another service; refusing to overwrite it.')
        print('Uploading reviewed static site...', flush=True)
        result = run(['npx', '--yes', 'wrangler@4.148.0', 'pages', 'deploy', 'public', '--project-name', PROJECT, '--branch', 'main', '--commit-dirty=true', '--commit-message', 'Launch agent-render'], env)
        (checks / 'deployment.log').write_text(redact(result.stdout + result.stderr))
        if DOMAIN not in project.get('domains', []):
            run(['cf', 'pages', 'domains', 'create', PROJECT, '--name', DOMAIN, '--dry-run'], env)
            run(['cf', 'pages', 'domains', 'create', PROJECT, '--name', DOMAIN], env)
        existing_dns = data(run(['cf', 'dns', 'records', 'list', '--zone', ZONE, '--name', DOMAIN], env))
        if not existing_dns:
            body = json.dumps({'type': 'CNAME', 'name': DOMAIN, 'content': pages_host, 'proxied': True, 'ttl': 1, 'comment': 'agent-render landing page'})
            run(['cf', 'dns', 'records', 'create', '--zone', ZONE, '--body', body, '--dry-run'], env)
            run(['cf', 'dns', 'records', 'create', '--zone', ZONE, '--body', body], env)
        current = data(run(['cf', 'pages', 'get', PROJECT], env))
        deployment = current.get('canonical_deployment') or current.get('latest_deployment') or {}
        receipt.update({'deploymentId': deployment.get('id'), 'deploymentUrl': deployment.get('url'), 'pagesUrl': 'https://' + pages_host, 'status': 'deployed'})
        receipt['domainState'] = data(run(['cf', 'pages', 'domains', 'get', DOMAIN, '--project-name', PROJECT], env))
        print(json.dumps(receipt), flush=True)
    finally:
        if token:
            revoked = run(['cf', 'user', 'tokens', 'delete', token['id'], '--force'], parent_env, check=False)
            receipt['temporaryTokenRevoked'] = revoked.returncode == 0
            if revoked.returncode:
                print('Token revocation failed; expiry is ' + expires, flush=True)
        (checks / 'deployment-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')


if __name__ == '__main__':
    main()
