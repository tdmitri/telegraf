/* eslint-disable @typescript-eslint/no-non-null-assertion */
export interface Node<E> {
  prev: Node<E> | null
  next: Node<E> | null
  elem: E
}

export class LinkedList<E> {
  public head: Node<E> | null = null
  public tail: Node<E> | null = null
  public length: number = 0

  public add(elem: E): Node<E> {
    // emptyness check
    if (this.tail === null) {
      this.head = this.tail = { prev: null, next: null, elem }
    } else {
      // create node from elem
      const node: Node<E> = { prev: null, next: null, elem }
      // link it to previous element (append operation)
      this.tail.next = node
      node.prev = this.tail
      this.tail = node
    }
    return this.tail
  }

  public remove(node: Node<E>): void {
    // Connecting the links of `prev` and `next` removes `node`
    if (this.head === node) this.head = node.next
    else node.prev!.next = node.next
    if (this.tail === node) this.tail = node.prev
    else node.next!.prev = node.prev
  }
}
