import http from 'node:http';

const port = Number(process.argv[2] || 8766);
const GUID = '203d28db-13c8-4889-b005-905be3453c71';

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(text)
  });
  res.end(text);
}

http.createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  if (url.pathname === '/api/login' && req.method === 'POST') {
    return json(res, 200, {
      msg: 'Login Successful',
      user: { id: 1, first_name: 'Test', last_name: 'Student' },
      token: 'fake|' + 'b'.repeat(40),
      role: 'STUDENT',
      authenticated: true,
      skippable: 1,
      course_id: '2027-al'
    });
  }
  if (!req.headers.authorization) return json(res, 401, { message: 'Unauthenticated.' });

  switch (url.pathname) {
    case '/api/user':
      return json(res, 200, {
        user: {
          id: 1, first_name: 'Test', last_name: 'Student',
          phone_number: '0700000000', course_id: '2027-al', role: 'STUDENT'
        }
      });
    case '/api/lessons/allowed':
      return json(res, 200, [
        { id: 151, title: 'Fixture lesson', description: 'x', created_at: '2026-01-01T00:00:00Z' }
      ]);
    case '/api/lessons/151':
      return json(res, 200, {
        lesson: { id: 151, title: 'Fixture lesson' },
        live: false,
        videos: [
          { id: 1131, title: 'CDN sample', video_url: `https://iframe.mediadelivery.net/embed/415489/${GUID}?preload=false` },
          { id: 1132, title: 'YouTube sample', video_url: 'https://www.youtube.com/embed/8JTkZgfrak0' }
        ]
      });
    case '/api/videos/1131':
      return json(res, 200, { video_url: `https://iframe.mediadelivery.net/embed/415489/${GUID}?preload=false` });
    case '/api/videos/1132':
      return json(res, 200, { video_url: 'https://www.youtube.com/embed/8JTkZgfrak0' });
    case '/api/videos/1131/generate-token':
    case '/api/videos/1132/generate-token':
      return json(res, 200, { message: 'Token generated successfully', token: 'a'.repeat(64), expires: 9999999999 });
    default:
      return json(res, 404, { message: 'not found', path: url.pathname });
  }
}).listen(port, '127.0.0.1', () => {
  console.log('fake api on http://127.0.0.1:' + port + '/api');
});
