from pathlib import Path
p=Path('src/WhatsAppSupportInbox.tsx');s=p.read_text(encoding='utf-8')
s=s.replace('  last_message?: string;', '  last_message?: string;\n  has_customer_messages?: boolean;')
s=s.replace('  const [reply,', '  const selectedRef = useRef("");\n  const nearBottomRef = useRef(true);\n  const [reply,')
s=s.replace('    setThread(payload.thread || null);', '    if (selectedRef.current !== threadId) return;\n    setThread(payload.thread || null);')
s=s.replace('        setSelectedId(nextSelected);', '        selectedRef.current = nextSelected; setSelectedId(nextSelected);')
s=s.replace('        setSelectedId("");', '        selectedRef.current = ""; setSelectedId("");')
s=s.replace('    setSelectedId(threadId);', '    selectedRef.current = threadId; nearBottomRef.current = true; setThread(null); setSelectedId(threadId);')
s=s.replace('      messageList.scrollTop = messageList.scrollHeight;', '      if (nearBottomRef.current) messageList.scrollTop = messageList.scrollHeight;')
s=s.replace('  const selectThread = async', '''  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") void load(true); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    return () => { clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);

  const selectThread = async''')
s=s.replace('      if (!quiet) setNotice(error instanceof Error', '      setNotice(error instanceof Error')
s=s.replace('      setNotice(action ===', '      await load(true); window.dispatchEvent(new Event("adoce-support-updated"));\n      setNotice(action ===')
s=s.replace('<strong>{threads.length} em atendimento</strong>', '<strong>{threads.filter(item => item.has_customer_messages).length} conversas com clientes</strong>')
s=s.replace('{item.automation_mode === "bot" ? "Com o robô" : "Com a equipe"}', '{!item.has_customer_messages ? "Somente avisos do pedido" : item.automation_mode === "bot" ? "Com o robô" : "Com a equipe"}')
s=s.replace('<button type="button" onClick={() => void act("takeover")} disabled={busy}>', '<button type="button" onClick={() => void act("takeover")} disabled={busy || thread.automation_mode === "human"}>')
s=s.replace('              </header>\n              <div ref={messageListRef}', '                <button type="button" onClick={() => void act("close")} disabled={busy}>Encerrar chat</button>\n              </header>\n              {!thread.messages.some(message => message.direction === "inbound") ? <p className="whatsapp-support-notice">Ainda não há mensagens recebidas deste cliente registradas. Abaixo estão os avisos disponíveis do pedido.</p> : null}\n              <div onScroll={() => { const list=messageListRef.current; if(list) nearBottomRef.current=list.scrollHeight-list.scrollTop-list.clientHeight < 90; }} ref={messageListRef}')
s=s.replace('Escolha uma conversa para atender.', 'Escolha uma conversa para ver o histórico completo. Não é preciso assumir para acompanhar.')
s=s.replace('    if (!selectedId || (action === "reply"', '    if (action === "reply" && thread?.automation_mode !== "human") return;\n    if (!selectedId || (action === "reply"')
p.write_text(s,encoding='utf-8')
p=Path('src/OperationManualSale.tsx');s=p.read_text(encoding='utf-8').replace('(data.threads || []).length', '(data.threads || []).filter((item: { has_customer_messages?: boolean }) => item.has_customer_messages).length')
s=s.replace('window.addEventListener("focus", refresh); return () =>', 'window.addEventListener("focus", refresh); window.addEventListener("adoce-support-updated", refresh); return () =>').replace('clearInterval(timer); window.removeEventListener("focus", refresh);', 'clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("adoce-support-updated", refresh);')
p.write_text(s,encoding='utf-8')
