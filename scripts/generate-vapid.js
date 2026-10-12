import { generateVapidKeys } from '@mmmike/web-push/vapid';
const keys = await generateVapidKeys();
console.log('\nVAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:deine-email@example.com\n');
