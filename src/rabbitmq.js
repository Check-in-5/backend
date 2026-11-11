import amqp from 'amqplib';

export async function publicar_evento(routingKey, data) {
  const url = process.env.BROKER_URL;
  const exchange = process.env.EVENT_EXCHANGE || 'ticketu.events';
  
  if (!url) {
    console.warn('BROKER_URL no definido. Omitiendo publicación en RabbitMQ.');
    return;
  }

  try {
    const conexion = await amqp.connect(url);
    const canal = await conexion.createChannel();
    
    await canal.assertExchange(exchange, 'topic', { durable: true });
    canal.publish(exchange, routingKey, Buffer.from(JSON.stringify(data)));
    
    setTimeout(() => {
      canal.close();
      conexion.close();
    }, 500);
  } catch (error) {
    console.error('Fallo al publicar en RabbitMQ:', error.message);
  }
}