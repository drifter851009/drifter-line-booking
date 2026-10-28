/* DRIFTER Body Passport Check-in: member only, gated by backend passportVersion. */
(function(){
'use strict';
var form=document.getElementById('bookingForm'),type=document.getElementById('customer_type'),submit=document.getElementById('submitBtn');
if(!form||!type||!submit||typeof BACKEND_URL!=='string')return;
var VER='BP-CHECKIN-2026-10',enabled=false;
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
function box(n,items){return '<div class="drbp-options">'+items.map(function(x){return '<label><input name="'+n+'" type="checkbox" value="'+esc(x)+'">'+esc(x)+'</label>'}).join('')+'</div>';}
function sel(n,title,values){return '<label>'+title+'<select name="'+n+'"><option value="">請選擇</option>'+values.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('')+'</select></label>';}
function score(n,title){return sel(n,title+'（0＝無，10＝非常明顯）',Array.from({length:11},function(_,i){return String(i)}));}
var el=document.createElement('section');el.id='drifterPassportCheckin';el.hidden=true;
el.innerHTML='<h2>Body Passport｜本次預約主訴</h2>'
+'<p class="drbp-help">會員預約前填寫本次身體狀況，協助工作室提前準備，並納入你的會員服務歷程。</p>'
+'<fieldset><legend>01｜本次服務需求</legend>'
+sel('bp_mainNeed','本次主要需求 *',['例行保養','放鬆與疲勞恢復','運動後恢復','局部緊繃','活動不順暢'])
+'<p>主要關注部位 *（選擇1～3個，60分鐘不提供全身施作）</p>'
+box('bp_parts',['頸部','肩部','上背','下背','臀部','髖部','大腿','膝部','小腿','足部','手臂','其他'])
+sel('bp_side','左右側（選填）',['左側','右側','雙側','不適用'])
+'<label>本次身體主訴 *（至少5個字）<textarea name="bp_complaint" maxlength="500" placeholder="例：這週練腿後髖部緊繃，希望優先處理髖部與臀部。"></textarea></label>'
+'</fieldset><fieldset><legend>02｜目前的身體感受</legend>'
+score('bp_fatigue','疲勞程度 *')+score('bp_tightness','緊繃程度 *')+score('bp_discomfort','不適程度 *')
+sel('bp_compared','與上次相比（選填）',['改善','差不多','加重','首次填寫','不確定'])
+'<label>睡眠與恢復（選填）<textarea name="bp_sleep" maxlength="150"></textarea></label>'
+'<label>最近的運動／活動量（選填）<textarea name="bp_activity" maxlength="150"></textarea></label>'
+'</fieldset><fieldset><legend>03｜施作安全確認</legend>'
+sel('bp_safety','最近兩週有無新傷、明顯腫脹或醫療人員交代的限制？ *',['無','有','不確定'])
+'<label>若有或不確定，請補充說明 *<textarea name="bp_safetyDetails" maxlength="500" placeholder="例如：近期扭傷、正在就醫、需避開某部位"></textarea></label>'
+'<label>不希望碰觸的部位（選填）<textarea name="bp_avoid" maxlength="250"></textarea></label>'
+'<p class="drbp-help">本表不是醫療診斷。如有新傷、明顯腫脹或醫療限制，工作室可能先聯絡確認並視情況調整或暫緩施作。</p>'
+'</fieldset><fieldset><legend>04｜資料告知與確認</legend>'
+'<p class="drbp-help">DRIFTER運動按摩工作室為預約管理、施作前準備、服務安全溝通和恢復紀錄，蒐集本次身體主訴與健康相關自述。僅由授權工作室人員及必要資訊服務業者在服務範圍使用，並以雲端服務保存；保存期間以服務、必要後續追蹤及法定義務所需為限。可透過官方LINE行使個資相關法定權利，依法有例外者除外。</p>'
+'<label class="drbp-ack"><input type="checkbox" name="bp_healthConsent">我已閱讀告知，並同意提供本次服務所需的健康相關資訊。</label>'
+'<label class="drbp-ack"><input type="checkbox" name="bp_truthConsent">我確認本次填寫為目前所知的真實狀況，若有變化將於服務前通知工作室。</label>'
+'</fieldset><p class="drbp-error" id="drifterPassportCheckinError" role="alert"></p>';
var css=document.createElement('style');
css.textContent='#drifterPassportCheckin{margin-top:26px;padding-top:18px;border-top:2px solid #dedede}#drifterPassportCheckin[hidden]{display:none}'
+'#drifterPassportCheckin h2{text-align:center;font-size:20px}#drifterPassportCheckin fieldset{border:1px solid #ddd;border-radius:12px;margin:14px 0;padding:14px}'
+'#drifterPassportCheckin legend{font-weight:bold;padding:0 6px}#drifterPassportCheckin label{font-size:14px;line-height:1.6}'
+'#drifterPassportCheckin textarea{width:100%;min-height:60px}#drifterPassportCheckin .drbp-options{display:flex;flex-wrap:wrap;gap:8px}'
+'#drifterPassportCheckin .drbp-options label{display:flex;align-items:center;gap:6px;border:1px solid #ddd;border-radius:10px;padding:8px}'
+'#drifterPassportCheckin input[type=checkbox]{width:18px;height:18px;accent-color:#111;flex:none}'
+'#drifterPassportCheckin .drbp-ack{display:flex;align-items:flex-start;gap:9px;margin:12px 0}'
+'#drifterPassportCheckin .drbp-help{color:#555;font-size:13px;line-height:1.7}#drifterPassportCheckin .drbp-error{color:#b21c31;font-size:14px}';
document.head.appendChild(css);form.insertBefore(el,submit);
var hidden=document.createElement('input');hidden.type='hidden';hidden.name='passport_checkin_json';form.appendChild(hidden);
function member(){return type.value==='會員預約'}
function sync(){el.hidden=!enabled||!member();if(el.hidden)hidden.value=''}
function val(n){return String(el.querySelector('[name="'+n+'"]')?.value||'').trim()}
function yes(n){return Boolean(el.querySelector('[name="'+n+'"]:checked'))}
function parts(){return Array.from(el.querySelectorAll('[name="bp_parts"]:checked')).map(function(x){return x.value})}
function limit(){var count=parts().length;el.querySelectorAll('[name="bp_parts"]').forEach(function(x){x.disabled=count>=3&&!x.checked})}
el.addEventListener('change',function(e){if(e.target?.name==='bp_parts')limit()});
document.querySelectorAll('.type-btn').forEach(function(btn){btn.addEventListener('click',sync)});
document.getElementById('phone')?.addEventListener('input',function(){setTimeout(sync,0)});
sync();
var cb='drifterPassportHealth_'+Math.random().toString(36).slice(2),tag=document.createElement('script'),done=false;
var timer=setTimeout(function(){finish(null)},8000);
function finish(d){if(done)return;done=true;clearTimeout(timer);try{delete window[cb]}catch(e){window[cb]=void 0}
if(tag.parentNode)tag.parentNode.removeChild(tag);
enabled=!!(d&&d.ok===true&&d.version==='2026-10-27-REQUIRED-ONEFILE'&&d.passportVersion===VER);sync();}
window[cb]=finish;tag.onerror=function(){finish(null)};
tag.src=BACKEND_URL+'?action=health&callback='+encodeURIComponent(cb)+'&ts='+Date.now();
document.head.appendChild(tag);
form.addEventListener('submit',function(e){
sync();if(!enabled||!member())return;
var d={mainNeed:val('bp_mainNeed'),parts:parts(),side:val('bp_side'),complaint:val('bp_complaint'),
fatigue:val('bp_fatigue'),tightness:val('bp_tightness'),discomfort:val('bp_discomfort'),
compared:val('bp_compared'),sleep:val('bp_sleep'),activity:val('bp_activity'),
safety:val('bp_safety'),safetyDetails:val('bp_safetyDetails'),avoid:val('bp_avoid'),
healthConsent:yes('bp_healthConsent'),truthConsent:yes('bp_truthConsent'),declarationVersion:VER};
var err='';
if(!d.mainNeed)err='請選擇本次主要需求。';
else if(d.parts.length<1||d.parts.length>3)err='請選擇1～3個主要關注部位。';
else if(d.complaint.length<5)err='請至少用5個字描述本次主訴。';
else if(d.fatigue===''||d.tightness===''||d.discomfort==='')err='請填寫疲勞、緊繃與不適三項分數。';
else if(!d.safety)err='請回答近期是否有新傷或醫療限制。';
else if(d.safety!=='無'&&d.safetyDetails.length<3)err='請補充近期安全狀況，方便施作前確認。';
else if(!d.healthConsent||!d.truthConsent)err='請完成告知同意與如實填寫確認。';
el.querySelector('#drifterPassportCheckinError').textContent=err;
if(err){e.preventDefault();e.stopImmediatePropagation();submit.disabled=false;submit.textContent='確認預約';el.scrollIntoView({block:'start',behavior:'smooth'});return}
hidden.value=JSON.stringify(d);
},true);
})();