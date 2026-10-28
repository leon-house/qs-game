import { Client } from 'ssh2';
const client = new Client();
client.on('ready', () => {
    client.sftp((err, sftp) => {
        if (err) { console.log('sftp err', err.message); client.end(); return; }
        sftp.readdir('/home/ubuntu/Leon-game/src/systems', (err, list) => {
            if (err) console.log('readdir err', err.message);
            else console.log('src/systems:', list.map(f => f.filename).filter(f => f.endsWith('.js')).join(', '));
            client.end();
        });
    });
});
client.on('error', e => console.log('conn err', e.message));
client.connect({
    host: '106.54.31.70', port: 22, username: 'ubuntu', password: '8}iQ}3@r123',
    readyTimeout: 10000,
});
