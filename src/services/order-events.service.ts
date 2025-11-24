import { EventEmitter } from 'events';

class OrderEventsService extends EventEmitter {
  private static instance: OrderEventsService;

  private constructor() {
    super();
    this.setMaxListeners(100); // Support many concurrent orders
  }

  static getInstance(): OrderEventsService {
    if (!OrderEventsService.instance) {
      OrderEventsService.instance = new OrderEventsService();
    }
    return OrderEventsService.instance;
  }

  emitOrderUpdate(orderId: string, status: string, data?: any) {
    this.emit(`order:${orderId}`, {
      orderId,
      status,
      timestamp: new Date().toISOString(),
      data,
    });
  }
}

export const orderEvents = OrderEventsService.getInstance();
