const net = require('net');

async function sendMailDevSmtp({ from, to, subject, html }) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(1025, '127.0.0.1');
    let step = 0;
    let resolved = false;

    const cleanupAndResolve = (val) => {
      if (!resolved) {
        resolved = true;
        try { socket.end(); } catch (e) {}
        resolve(val);
      }
    };

    const cleanupAndReject = (err) => {
      if (!resolved) {
        resolved = true;
        try { socket.destroy(); } catch (e) {}
        reject(err);
      }
    };

    socket.setTimeout(5000, () => {
      cleanupAndReject(new Error('Timeout connecting or communicating with MailDev SMTP (127.0.0.1:1025)'));
    });

    socket.on('error', (err) => {
      cleanupAndReject(new Error(`Failed to connect to MailDev SMTP (127.0.0.1:1025): ${err.message}`));
    });

    socket.on('end', () => {
      if (step >= 5) cleanupAndResolve({ success: true });
    });

    socket.on('close', () => {
      if (step >= 5) cleanupAndResolve({ success: true });
    });

    socket.on('data', (data) => {
      const response = data.toString();
      if (step === 0 && response.startsWith('220')) {
        step = 1;
        socket.write('EHLO localhost\r\n');
      } else if (step === 1 && response.startsWith('250')) {
        step = 2;
        socket.write(`MAIL FROM:<${from}>\r\n`);
      } else if (step === 2 && response.startsWith('250')) {
        step = 3;
        socket.write(`RCPT TO:<${to}>\r\n`);
      } else if (step === 3 && response.startsWith('250')) {
        step = 4;
        socket.write('DATA\r\n');
      } else if (step === 4 && response.startsWith('354')) {
        step = 5;
        const emailContent = [
          `From: ${from}`,
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/html; charset=utf-8',
          '',
          html,
          '\r\n.'
        ].join('\r\n');
        socket.write(emailContent + '\r\n');
      } else if (step === 5 && response.startsWith('250')) {
        step = 6;
        socket.write('QUIT\r\n');
        cleanupAndResolve({ success: true });
      } else if (step === 6) {
        cleanupAndResolve({ success: true });
      }
    });
  });
}

module.exports = {
  sendMailDevSmtp
};
