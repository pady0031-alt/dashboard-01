// Menú móvil responsive y accesible
document.addEventListener('DOMContentLoaded',function(){
  var toggle=document.querySelector('.nav-toggle');
  var links=document.querySelector('nav.links');
  if(toggle&&links){
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click',function(e){
      e.stopPropagation();
      var isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      toggle.textContent = isOpen ? '✕' : '☰';
      toggle.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    });

    links.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click',function(){
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-label', 'Abrir menú');
      });
    });

    document.addEventListener('click', function(e){
      if(links.classList.contains('open') && !links.contains(e.target) && !toggle.contains(e.target)){
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-label', 'Abrir menú');
      }
    });

    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && links.classList.contains('open')){
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
        toggle.setAttribute('aria-label', 'Abrir menú');
      }
    });
  }

  // Scroll reveal
  var reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    },{threshold:0.12});
    reveals.forEach(function(el){io.observe(el);});
  }else{
    reveals.forEach(function(el){el.classList.add('in');});
  }

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function(item){
    var q=item.querySelector('.faq-q');
    if(q){
      q.addEventListener('click',function(){
        var wasOpen=item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function(i){i.classList.remove('open');});
        if(!wasOpen)item.classList.add('open');
      });
    }
  });

  // Contact form (demo — sin backend)
  var form=document.getElementById('contactForm');
  if(form){
    form.addEventListener('submit',function(e){
      e.preventDefault();
      form.style.display='none';
      document.getElementById('formSuccess').style.display='block';
    });
  }

  // ===================================================================
  // ASISTENTE DE IA EN VIVO (Bottom-Right Chat)
  // ===================================================================
  initAiChat();
});

function initAiChat() {
  if (document.querySelector('.ai-chat-container')) return;

  var chatContainer = document.createElement('div');
  chatContainer.className = 'ai-chat-container';
  chatContainer.innerHTML = `
    <div class="ai-chat-window" id="aiChatWindow">
      <div class="ai-chat-header">
        <div class="ai-chat-header-left">
          <div class="ai-chat-header-orb">IA</div>
          <div class="ai-chat-header-text">
            <h4>Centro de Mando IA</h4>
            <span>En línea · Asistente oficial</span>
          </div>
        </div>
        <div class="ai-chat-header-actions">
          <button class="ai-chat-btn-icon" id="aiChatResetBtn" title="Reiniciar conversación" aria-label="Reiniciar">↺</button>
          <button class="ai-chat-btn-icon" id="aiChatCloseBtn" title="Cerrar chat" aria-label="Cerrar">✕</button>
        </div>
      </div>

      <div class="ai-chat-chips" id="aiChatChips">
        <button class="ai-chat-chip" data-q="¿Cómo se conecta Excel y Power BI?">📊 Excel & Power BI</button>
        <button class="ai-chat-chip" data-q="¿Cuáles son los precios y qué incluye cada plan?">💳 Precios y Planes</button>
        <button class="ai-chat-chip" data-q="¿Qué módulos y KPIs puedo activar?">⚙️ Módulos y KPIs</button>
        <button class="ai-chat-chip" data-q="¿Cómo garantizáis la seguridad y el RGPD?">🔒 Seguridad y RGPD</button>
        <button class="ai-chat-chip" data-q="¿Cómo puedo solicitar una demo para mi empresa?">🚀 Solicitar Demo</button>
      </div>

      <div class="ai-chat-messages" id="aiChatMessages">
        <div class="ai-msg ai-msg-bot">
          <p>¡Hola! Soy el asistente inteligente de <strong>Centro de Mando IA</strong>.</p>
          <p>Puedo resolver cualquier duda sobre nuestros <strong>servicios</strong>, conexión con <strong>Excel y Power BI</strong>, <strong>módulos</strong>, <strong>planes</strong> o cómo <strong>solicitar una demo</strong> para tu negocio.</p>
          <div class="ai-msg-meta">Centro de Mando IA · Ahora</div>
        </div>
      </div>

      <div class="ai-typing-indicator" id="aiTypingIndicator">
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
        <span class="ai-typing-text">Asistente IA analizando respuesta...</span>
      </div>

      <div class="ai-chat-footer">
        <form class="ai-chat-input-form" id="aiChatForm">
          <input type="text" class="ai-chat-input" id="aiChatInput" placeholder="Pregunta sobre servicios, precios, integración..." autocomplete="off" required>
          <button type="submit" class="ai-chat-send-btn" id="aiChatSendBtn" title="Enviar consulta" aria-label="Enviar">➤</button>
        </form>
        <div class="ai-chat-footnote">IA en tiempo real · Conexión Excel, Power BI y ERPs</div>
      </div>
    </div>

    <button class="ai-chat-launcher" id="aiChatLauncher" aria-label="Abrir asistente de IA">
      <div class="ai-chat-launcher-orb">
        IA
        <div class="ai-chat-launcher-pulse"></div>
      </div>
      <div class="ai-chat-launcher-info">
        <div class="ai-chat-launcher-title">Asistente IA</div>
        <div class="ai-chat-launcher-status">Dudas &amp; Servicios</div>
      </div>
    </button>
  `;

  document.body.appendChild(chatContainer);

  var launcher = document.getElementById('aiChatLauncher');
  var windowEl = document.getElementById('aiChatWindow');
  var closeBtn = document.getElementById('aiChatCloseBtn');
  var resetBtn = document.getElementById('aiChatResetBtn');
  var formEl = document.getElementById('aiChatForm');
  var inputEl = document.getElementById('aiChatInput');
  var messagesEl = document.getElementById('aiChatMessages');
  var typingEl = document.getElementById('aiTypingIndicator');
  var chipsEl = document.getElementById('aiChatChips');

  var history = [];

  function formatMarkdown(text) {
    if (!text) return '';
    var escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold **text**
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Links [text](url)
    escaped = escaped.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

    // Bullet points
    var lines = escaped.split('\n');
    var inList = false;
    var output = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.startsWith('• ') || line.startsWith('- ') || line.startsWith('* ')) {
        if (!inList) {
          output.push('<ul>');
          inList = true;
        }
        output.push('<li>' + line.substring(2) + '</li>');
      } else if (/^\d+\.\s/.test(line)) {
        if (!inList) {
          output.push('<ol>');
          inList = true;
        }
        output.push('<li>' + line.replace(/^\d+\.\s/, '') + '</li>');
      } else {
        if (inList) {
          output.push('</ul>');
          inList = false;
        }
        if (line.length > 0) {
          output.push('<p>' + line + '</p>');
        }
      }
    }
    if (inList) output.push('</ul>');
    return output.join('');
  }

  function toggleChat(forceOpen) {
    var isOpen = typeof forceOpen === 'boolean' ? forceOpen : !windowEl.classList.contains('open');
    if (isOpen) {
      windowEl.classList.add('open');
      launcher.style.display = 'none';
      setTimeout(function(){ inputEl.focus(); }, 150);
    } else {
      windowEl.classList.remove('open');
      launcher.style.display = 'flex';
    }
  }

  launcher.addEventListener('click', function(){ toggleChat(true); });
  closeBtn.addEventListener('click', function(){ toggleChat(false); });

  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && windowEl.classList.contains('open')) {
      toggleChat(false);
    }
  });

  resetBtn.addEventListener('click', function(){
    history = [];
    messagesEl.innerHTML = `
      <div class="ai-msg ai-msg-bot">
        <p>Conversación reiniciada. ¿En qué más puedo orientarte sobre <strong>Centro de Mando IA</strong>?</p>
        <div class="ai-msg-meta">Centro de Mando IA · Ahora</div>
      </div>
    `;
    inputEl.focus();
  });

  // Chips click handler
  if (chipsEl) {
    chipsEl.querySelectorAll('.ai-chat-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var query = chip.getAttribute('data-q');
        if (query) {
          sendMessage(query);
        }
      });
    });
  }

  function appendMessage(sender, text) {
    var msgDiv = document.createElement('div');
    msgDiv.className = 'ai-msg ' + (sender === 'user' ? 'ai-msg-user' : 'ai-msg-bot');
    
    var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var senderLabel = sender === 'user' ? 'Tú' : 'Centro de Mando IA';

    if (sender === 'user') {
      msgDiv.innerHTML = `
        <p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
        <div class="ai-msg-meta">${senderLabel} · ${timeStr}</div>
      `;
    } else {
      msgDiv.innerHTML = `
        ${formatMarkdown(text)}
        <div class="ai-msg-meta">${senderLabel} · ${timeStr}</div>
      `;
    }

    messagesEl.appendChild(msgDiv);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendMessage(text) {
    var userText = text || inputEl.value.trim();
    if (!userText) return;

    inputEl.value = '';
    appendMessage('user', userText);
    history.push({ role: 'user', content: userText });

    typingEl.classList.add('active');
    messagesEl.scrollTop = messagesEl.scrollHeight;

    var sendBtn = document.getElementById('aiChatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    try {
      var res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, history: history })
      });

      var data = await res.json();
      typingEl.classList.remove('active');
      if (sendBtn) sendBtn.disabled = false;

      var reply = data.reply || 'Disculpa, no he podido procesar la respuesta en este momento. Por favor contáctanos en hola@centrodemando.ia.';
      appendMessage('bot', reply);
      history.push({ role: 'model', content: reply });
    } catch (err) {
      console.error('Error fetching chat response:', err);
      typingEl.classList.remove('active');
      if (sendBtn) sendBtn.disabled = false;
      appendMessage('bot', 'No ha sido posible conectar con el servidor. Puedes escribirnos a **hola@centrodemando.ia** o visitar nuestra sección de [Contacto](contacto.html).');
    }
  }

  formEl.addEventListener('submit', function(e){
    e.preventDefault();
    sendMessage();
  });
}
