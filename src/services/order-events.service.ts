import { EventEmitter } from 'events';

class OrderEventsService extends EventEmitter {
  private static instance: OrderEventsService;

  private constructor() {
    super();
    this.setMaxListeners(1000);
    console.log('🎯 OrderEventsService initialized');
  }

  static getInstance(): OrderEventsService {
    if (!OrderEventsService.instance) {
      OrderEventsService.instance = new OrderEventsService();
    }
    return OrderEventsService.instance;
  }

  emitOrderUpdate(orderId: string, status: string, data?: any) {
    const payload = {
      orderId,
      status,
      timestamp: new Date().toISOString(),
      data,
    };

    console.log(`🔔 EMITTING EVENT for order: ${orderId.substring(0, 8)}... status: ${status}`);
    console.log(`📡 'orderUpdate' listener count:`, this.listenerCount('orderUpdate'));
    console.log(`📡 'order:${orderId}' listener count:`, this.listenerCount(`order:${orderId}`));

    // Emit to specific order channel (for single order WebSocket)
    this.emit(`order:${orderId}`, payload);

    // ALSO emit to global channel (for multi-order WebSocket)
    this.emit('orderUpdate', payload);

    console.log('✅ Events emitted to both channels');
  }
}

export const orderEvents = OrderEventsService.getInstance();
