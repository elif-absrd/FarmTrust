const axios = require('axios');

async function sendExpoPush({ expoPushToken, title, body, data }) {
  if (!expoPushToken) return null;

  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data: data || {},
  };

  const response = await axios.post('https://exp.host/--/api/v2/push/send', message, {
    headers: {
      Accept: 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
  });

  return response.data;
}

module.exports = { sendExpoPush };
