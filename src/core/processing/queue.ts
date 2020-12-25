/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { LinkedList, Node } from './list'
interface Drift<E> {
  task: Promise<void>
  date: number
  elem: E
}
interface NodeContainer<E> {
  node: Node<Drift<E>> | null
}
export class DecayingDeque<E> {
  private readonly list: LinkedList<Drift<E>> = new LinkedList()
  private readonly concurrency: number
  private timer: NodeJS.Timeout | undefined
  private subscribers: Array<(capacity: number) => void> = []
  constructor(
    private readonly handlerTimeout: number,
    private readonly worker: (t: E) => Promise<void>,
    concurrency: boolean | number,
    private readonly catchError: (err: unknown, elem: E) => Promise<void>,
    private readonly catchTimeout: (t: E, task: Promise<void>) => void
  ) {
    if (concurrency === false) this.concurrency = 1
    else if (concurrency === true) this.concurrency = Infinity
    else this.concurrency = concurrency < 1 ? 1 : concurrency
  }

  add(elems: E[]): Promise<number> {
    const len = elems.length
    if (this.list.length === 0 && len > 0) this.startTimer()
    const now = Date.now()
    for (let i = 0; i < len; i++) {
      const nodeContainer: NodeContainer<E> = { node: null }
      const drift = this.toDrift(elems[i++]!, now, nodeContainer)
      const node = this.list.add(drift)
      nodeContainer.node = node
    }
    const capacity = this.concurrency - this.list.length
    return capacity > 0
      ? Promise.resolve(capacity)
      : new Promise((resolve) => this.subscribers.push(resolve))
  }

  private decay(node: Node<Drift<E>>): void {
    const head = this.list.head
    if (head === node && node.elem.date !== head.elem.date) {
      if (this.timer !== undefined) clearTimeout(this.timer)
      if (this.list.length === 0) this.timer = undefined
      else
        this.startTimer(head.next!.elem.date + this.handlerTimeout - Date.now())
    }
    this.remove(node)
  }

  private remove(node: Node<Drift<E>>): void {
    this.list.remove(node)
    node.elem.date = -1
    const capacity = this.concurrency - this.list.length
    if (capacity > 0) {
      this.subscribers.forEach((resolve) => resolve(capacity))
      this.subscribers = []
    }
  }

  private toDrift(
    elem: E,
    date: number,
    nodeContainer: { node: Node<Drift<E>> | null }
  ): Drift<E> {
    const node: Drift<E> = {
      task: this.worker(elem)
        .catch(async (err) => {
          if (node.date > 0) await this.catchError(err, elem)
          else throw err
        })
        .finally(() => {
          if (node.date > 0 && nodeContainer.node !== null)
            this.decay(nodeContainer.node)
        }),
      date,
      elem,
    }
    return node
  }

  private startTimer(ms = this.handlerTimeout): void {
    if (ms < 1) setImmediate(() => this.timeout())
    else this.timer = setTimeout(() => this.timeout(), ms).unref()
  }

  private timeout(): void {
    if (this.list.head === null) return
    while (this.list.head.elem.date === this.list.head.next?.elem.date) {
      this.catchTimeout(this.list.head.elem.elem, this.list.head.elem.task)
      this.remove(this.list.head)
    }
    this.catchTimeout(this.list.head.elem.elem, this.list.head.elem.task)
    this.decay(this.list.head)
  }
}
