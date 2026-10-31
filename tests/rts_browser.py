from playwright.sync_api import sync_playwright, expect
import os
from pathlib import Path
Path("/tmp/voidfront-checks").mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1440,'height':1000},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto(os.environ.get('VOID_FRONT_URL', 'http://127.0.0.1:3000'),wait_until='networkidle')
 expect(page.locator('h1')).to_contain_text('미지의 땅')
 page.screenshot(path='/tmp/voidfront-checks/briefing.png')
 page.locator('#begin').click()
 expect(page.locator('#unit-name')).to_have_text('행성 지휘소')
 page.get_by_role('button',name='작업자 생산').click()
 assert page.evaluate('voidFront.state.entities.find(e=>e.type==="hq"&&e.team===0).queue.length')==1
 page.wait_for_timeout(6500)
 assert page.evaluate('voidFront.state.entities.filter(e=>e.type==="worker").length')==7
 assert page.evaluate('voidFront.state.minerals')>450
 print('PASS: start, headquarters selection, production queue, worker spawning, autonomous mineral gathering')
 # Select worker by world-to-screen coordinates and construct a supply depot.
 state=page.evaluate('voidFront.state');worker=next(e for e in state['entities'] if e['type']=='worker')
 box=page.locator('#game').bounding_box();cam=state['camera']
 def screen(x,y): return (box['x']+(x-cam['x'])*cam['zoom']+box['width']/2,box['y']+(y-cam['y'])*cam['zoom']+box['height']/2)
 page.mouse.click(*screen(worker['x'],worker['y']))
 expect(page.locator('#unit-name')).to_have_text('건설 작업자')
 page.get_by_role('button',name='보급소',exact=False).click()
 page.mouse.click(*screen(820,1420))
 assert page.evaluate('voidFront.state.entities.filter(e=>e.type==="depot"&&e.team===0).length')==2
 print('PASS: worker selection and supply depot placement')
 page.wait_for_function('voidFront.state.entities.filter(e=>e.type==="depot"&&e.team===0).every(e=>e.progress===1)', timeout=30000)
 assert page.evaluate('voidFront.state.entities.filter(e=>e.type==="depot"&&e.team===0).every(e=>e.progress===1)')
 assert page.evaluate('voidFront.state.supply.max')==32
 print('PASS: worker travel, construction completion and supply expansion')
 # Drag-select infantry, then issue movement and attack movement.
 cam=page.evaluate('voidFront.state.camera')
 page.mouse.move(*screen(680,1340));page.mouse.down();page.mouse.move(*screen(810,1410),steps=10);page.mouse.up()
 assert len(page.evaluate('voidFront.state.selected'))>=4
 page.mouse.click(*screen(1010,1320),button='right')
 page.wait_for_timeout(2000)
 assert page.evaluate('voidFront.state.entities.filter(e=>e.team===0&&e.type==="marine").some(e=>e.x>820)')
 page.keyboard.press('a');assert page.evaluate('voidFront.state.mode')=='attack'
 page.mouse.click(*screen(1150,1230))
 assert page.evaluate('voidFront.state.entities.some(e=>e.team===0&&e.order?.kind==="attackMove")')
 page.keyboard.press('Control+1');page.mouse.click(*screen(430,1230));page.keyboard.press('1')
 assert len(page.evaluate('voidFront.state.selected'))>=4
 print('PASS: drag selection, formation movement, attack movement and control group recall')
 page.locator('#pause').click();before=page.evaluate('voidFront.state.elapsed');page.wait_for_timeout(300);assert page.evaluate('voidFront.state.elapsed')==before
 page.locator('#pause').click();page.screenshot(path='/tmp/voidfront-checks/gameplay.png')
 page.wait_for_function('voidFront.state.elapsed>39', timeout=45000)
 assert page.evaluate('voidFront.state.entities.filter(e=>e.team===1).length')>13
 print('PASS: pause/resume and enemy reinforcement wave')
 page.wait_for_function('voidFront.state.entities.some(e=>e.hp<e.maxHp)',timeout=30000)
 print('PASS: AI engagement and combat damage')
 # Restart returns all resources and armies to their initial state.
 page.locator('#restart').click();assert page.evaluate('voidFront.state.elapsed')<1
 assert page.evaluate('voidFront.state.entities.filter(e=>e.team===0&&e.type==="worker").length')==6
 assert not errors,errors
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(500)
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/voidfront-checks/mobile.png')
 print('PASS: restart, mobile layout and no JavaScript exceptions')
 b.close()
