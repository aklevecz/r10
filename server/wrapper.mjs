
import { handler } from './renderer.js';

const event = JSON.parse(process.argv[2]);
handler(event).then(result => {
    console.log(JSON.stringify(result));
    process.exit(0);
}).catch(error => {
    console.error(JSON.stringify({ status: 'error', message: error.message }));
    process.exit(1);
});
