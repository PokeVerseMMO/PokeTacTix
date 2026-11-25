local C=require(script and game.ReplicatedStorage.AutoChess.Config or "../shared/Config")
local R=require(script and game.ReplicatedStorage.AutoChess.Roster or "../shared/Roster")
local H=require(script and game.ReplicatedStorage.AutoChess.Hex or "../shared/Hex")
local D=require(script and game.ReplicatedStorage.AutoChess.Balance or "../shared/Balance")
local G=require(script and script.Parent.Game or "./Game")
local Boss=require(script and game.ReplicatedStorage.AutoChess.BossMechanics or "../shared/BossMechanics")
local SkillEvents=require(script and game.ReplicatedStorage.AutoChess.CharacterSkillEvents or "../shared/CharacterSkillEvents")
local Expansion=require(script and game.ReplicatedStorage.AutoChess.ExpansionAbilities or "../shared/ExpansionAbilities")
local Classes=require(script and game.ReplicatedStorage.AutoChess.ClassSynergies or "../shared/ClassSynergies")
local B={};local W={};W.__index=W
require(script and script.Parent.CombatControl or './CombatControl').install(W)
local function distance(a,b) return H.distance(a,b) end
local function point(u) return {col=u.col,row=u.row} end
function W:log(kind,u,v,value,name)
    local credit=self:credit(u)
    table.insert(self.events,{time=self.time,kind=kind,source=u and u.uid,side=u and (u.ownerSide or u.side),target=v and v.uid,targetSide=v and (v.ownerSide or v.side),value=value,name=name,
        creditedSource=credit~=u and credit and credit.uid or nil,creditedSide=credit~=u and credit and (credit.ownerSide or credit.side) or nil})
end
function W:random() self.seed=(self.seed*48271)%2147483647;return self.seed/2147483647 end
function W:alive(side)
    local a={};for _,u in ipairs(self.units) do if u.hp>0 and u.side==side then table.insert(a,u) end end;return a
end
function W:buff(u,key,values,duration,source)
    values.untilTime=self.time+Classes.duration(source,duration);u.buffs[key]=values
end
function W:value(u,field)
    local n=0;for _,b in pairs(u.buffs) do if b.untilTime>self.time then n=n+(b[field] or 0) end end;return n
end
function W:strongest(u,field)
    local n=0;for _,b in pairs(u.buffs) do if b.untilTime>self.time then n=math.max(n,b[field] or 0) end end;return n
end
function W:stats(u)
    local adBonus=(u.bonus.attack or 0)+self:value(u,"attack")
    if u.d.faction=="CSM" then adBonus=adBonus+(1-u.hp/u.maxHp)*.2*u.factionRank end
    local ad=u.d.attack*u.scale*(u.attackMult or 1)*(1+adBonus)*(1-self:strongest(u,"adWeak"))
    local power=1+(u.bonus.power or 0)+(u.d.faction=="JJK" and math.min(5,u.casts)*.06*u.factionRank or 0)
    local speedBonus=(u.bonus.speed or 0)+self:value(u,"speed")-self:strongest(u,"speedPenalty")+Boss.speed(u)
    if u.d.faction=="SAO" then speedBonus=speedBonus+math.min(u.factionRank==2 and .35 or .18,u.hits*(u.factionRank==2 and .05 or .03))*math.min(1,u.factionRank) end
    if u.carry then speedBonus=speedBonus+math.min(.24,u.hits*.03) end
    local speed=math.clamp(u.d.speed*(1+speedBonus)*(1-self:strongest(u,"slow")),.25,D.MaxAttackSpeed)
    return ad,power,speed,u.d.armor+(u.bonus.armor or 0)+self:value(u,"armor"),u.d.mr+(u.bonus.mr or 0)+self:value(u,"mr")
end
function W:nearest(u,side,maxRange)
    local a=self:alive(side or 3-u.side)
    table.sort(a,function(x,y) local dx,dy=distance(u,x),distance(u,y);if dx~=dy then return dx<dy end;return x.uid<y.uid end)
    if maxRange then local filtered={};for _,v in ipairs(a) do if distance(u,v)<=maxRange then table.insert(filtered,v) end end;return filtered end
    return a
end
function W:lowest(u,side,maxRange)
    local a=self:nearest(u,side,maxRange)
    table.sort(a,function(x,y) if x.hp/x.maxHp~=y.hp/y.maxHp then return x.hp/x.maxHp<y.hp/y.maxHp end
        if distance(u,x)~=distance(u,y) then return distance(u,x)<distance(u,y) end;return x.uid<y.uid end)
    return a[1]
end
function W:highestHP(side)
    local best;for _,v in ipairs(self:alive(side)) do if not best or v.maxHp>best.maxHp or v.maxHp==best.maxHp and v.uid<best.uid then best=v end end;return best
end
function W:fx(u,kind,target)
    u.fxSequence=(u.fxSequence or 0)+1
    u.effects=u.effects or {};table.insert(u.effects,{kind=kind,col=target.col,row=target.row,sequence=u.fxSequence})
end
function W:supportTarget(u,key,range,predicate)
    local eligible={}
    for _,v in ipairs(self:nearest(u,u.side,range)) do
        local locked=(v.supportLocks[key] or 0)>self.time+1e-6
        if key=="rika" then
            local shield=v.shields.rika
            locked=shield and shield.expires>self.time and shield.amount>0
            local total=0
            for _,s in pairs(v.shields) do if s.expires>self.time then total=total+s.amount end end
            locked=locked or total>=v.maxHp*.4-1e-6
        end
        if not locked and (not predicate or predicate(v)) then table.insert(eligible,v) end
    end
    table.sort(eligible,function(a,b)
        if a.hp/a.maxHp~=b.hp/b.maxHp then return a.hp/a.maxHp<b.hp/b.maxHp end
        if distance(u,a)~=distance(u,b) then return distance(u,a)<distance(u,b) end
        return a.uid<b.uid
    end)
    return eligible[1]
end
function W:hot(u,v,total,seconds,key)
    -- Snapshot recipient HP and healing output; scheduled healing cannot revive a dead target.
    local amount=total*u.healPower/seconds
    v.supportLocks[key]=self.time+seconds
    for tick=1,seconds do
        self:schedule(tick,function() self:heal(u,v,amount,false) end)
    end
    self:fx(u,"heal",v)
end
function W:checkCrystals(damaged)
    if damaged.hp<=0 or damaged.hp/damaged.maxHp>=.5 then return end
    for _,u in ipairs(self.units) do
        if u.side==damaged.side and u.hp>0 and u.items.healing_crystal and not u.crystalUsed and distance(u,damaged)<=2 then
            local v=self:supportTarget(u,"healing_crystal",2,function(ally) return ally.hp/ally.maxHp<.5 end)
            if v then
                u.crystalUsed=true;self:hot(u,v,v.maxHp*.15,3,"healing_crystal")
                self:log("item",u,v,0,"Healing Crystal")
            end
        end
    end
end
function W:supportItems(u)
    if u.items.devil_blood and self.time+1e-6>=u.bloodSupplyAt then
        u.bloodSupplyAt=u.bloodSupplyAt+6
        if u.bloodSupplyUses<3 then
            local v=self:supportTarget(u,"devil_blood",2,function(ally) return ally.hp<ally.maxHp end)
            if v then
                u.bloodSupplyUses=u.bloodSupplyUses+1;v.supportLocks.devil_blood=self.time+6
                self:heal(u,v,v.maxHp*.06,true);self:fx(u,"heal",v)
                self:log("item",u,v,0,"Devil Blood Supply")
            end
        end
    end
    if u.items.signal and self.time+1e-6>=u.signalAt then
        u.signalAt=u.signalAt+8;local count=0
        for _,v in ipairs(self:nearest(u,u.side,2)) do
            if v~=u and not v.cast and v.energy<v.d.maxMana and (v.supportLocks.signal or 0)<=self.time+1e-6 and count<2 then
                local gain=math.min(20,v.d.maxMana-v.energy);v.energy=v.energy+gain
                v.supportLocks.signal=self.time+8;count=count+1
                self:log("mana",u,v,gain,"Survey Corps Signal Flare");self:fx(u,"mana",v)
            end
        end
    end
end
function W:shield(u,v,amount,key,duration)
    if v.hp<=0 then return end
    local power=u and u.healPower or 1
    amount=amount*power
    local old=v.shields[key];local other=0
    for k,s in pairs(v.shields) do if s.expires>self.time and k~=key then other=other+s.amount end end
    local kept=old and old.expires>self.time and old.amount or 0
    v.shields[key]={amount=math.max(0,math.min(math.max(amount,kept),v.maxHp*.4-other)),expires=self.time+Classes.duration(u,duration or 4)}
    self:log("shield",u,v,v.shields[key].amount,key);self:fx(v,"shield",v)
end
function W:heal(u,v,amount,amplify)
    if v.hp<=0 then return end
    amount=amount*(amplify and u.healPower or 1)*(1-self:strongest(v,"antiheal"))
    local actual=math.max(0,math.min(v.maxHp-v.hp,amount));v.hp=v.hp+actual
    self:log("heal",u,v,actual)
    local credit=self:credit(u);if credit then credit.healed=(credit.healed or 0)+actual end
end
function W:interrupt(u,v,reason)
    if not v.cast then return end
    Boss.cancel(self,v,"interrupt");SkillEvents.stop(self,v,"interrupt")
    self:log("interrupt",u,v,0,reason);v.cast=nil;v.casting=nil
end
function W:stun(u,v,duration)
    if v.hp<=0 then return end
    duration=Classes.duration(u,duration)
    local oldLock=v.lockUntil or 0;local interrupted=v.cast~=nil
    v.stunUntil=math.max(v.stunUntil or 0,self.time+duration)
    if v.cast then
        Boss.cancel(self,v,"interrupt");SkillEvents.stop(self,v,"interrupt")
        self:log("interrupt",u,v,0,v.d.ability);v.cast=nil
        if v.id=="levi" then v.buffs.assault=nil end
    end
    v.lockUntil=math.max(v.lockUntil or 0,v.stunUntil)
    if v.items.curing and not v.curingUsed then
        v.curingUsed=true;v.stunUntil=self.time;v.lockUntil=interrupted and self.time or oldLock
        v.bleeds={};v.casting=nil
        self:log("cleanse",v,v,0,"Curing Crystal");self:fx(v,"cleanse",v)
    end
end
function W:damage(u,v,raw,damageType,options)
    options=options or {};if not v or v.hp<=0 then return 0 end
    local kind=options.kind or "ability";local direct=kind=="basic" or kind=="ability"
    options.kind=kind
    if kind=='basic' and u.control then raw=raw*u.control.basicMultiplier*u.control.power end
    if kind=="ability" and u.transformed and D.TransformUnits[u.id] then raw=raw*(1+D.TransformDamageBonus) end
    if direct and Expansion.marked(u,v) then raw=raw*1.3 end
    if v.items.koukaku and kind=="basic" and (options.critBonus or 0)>0 then
        raw=raw*(1+options.critBonus*.5)/(1+options.critBonus)
    end
    if raw>0 and v.items.liberator and kind=="basic" and self.time+1e-6>=(v.liberatorAt or 0) then
        raw=raw*.6;v.liberatorAt=self.time+4;self:fx(v,"guard",v)
    end
    if raw>0 and v.items.simple_domain and kind=="ability" and self.time+1e-6>=(v.domainAt or 0) then
        raw=raw*.7;v.domainAt=self.time+6;self:fx(v,"guard",v)
    end
    local _,_,_,armor,mr=self:stats(v)
    local defense=damageType=="physical" and armor or mr
    defense=defense*(1-self:strongest(v,damageType=="physical" and "armorShred" or "mrShred"))
    local pen=options.pen or 0
    if kind=="basic" then pen=D.penetration(u.items.soul and .25 or 0,u.d.role=="Ranger" and .1*math.min(2,u.roleRank) or 0) end
    if damageType=="physical" then defense=defense*(1-math.min(.5,pen)) end
    local bonus=direct and u.d.faction=="AOT" and v==self:highestHP(v.side) and .12*u.factionRank or 0
    Classes.capture(u,v,raw*(1+bonus),damageType,options)
    local dealt=raw*(1+bonus)*(1-(options.weak or 0))*D.mitigation(defense)*(1-math.min(.5,self:value(v,"reduction")))*Boss.incoming(self,u,v,kind)
    -- Stable order makes overlapping shields deterministic.
    local keys={};for k in pairs(v.shields) do table.insert(keys,k) end;table.sort(keys)
    for _,k in ipairs(keys) do local s=v.shields[k];if s.expires>self.time then local absorb=math.min(dealt,s.amount);s.amount=s.amount-absorb;dealt=dealt-absorb end end
    local saved=v.items.pochita and not v.pochitaUsed and dealt>=v.hp
    local actual=math.max(0,math.min(saved and math.max(0,v.hp-1) or v.hp,dealt));v.hp=v.hp-actual
    if saved then
        v.hp=1;v.pochitaUsed=true;self:shield(v,v,v.maxHp*.15,"pochita",2)
        self:hot(v,v,v.maxHp*.1,2,"pochita");self:log("save",v,v,0,"Pochita's Contract")
    end
    self:log(kind,u,v,actual,damageType)
    if kind=="ability" and not options.skillCounter then SkillEvents.hit(self,u,v) end
    local credit=options.credit or self:credit(u)
    credit.dealt=(credit.dealt or 0)+actual;v.taken=(v.taken or 0)+actual
    if actual>0 and not v.cast then
        local recent,total={},0
        for _,m in ipairs(v.damageMana) do if self.time-m.time<1-1e-6 then table.insert(recent,m);total=total+m.amount end end
        local gain=math.max(0,math.min(D.DamageManaCap-total,actual/v.maxHp*100))
        table.insert(recent,{time=self.time,amount=gain});v.damageMana=recent;v.energy=math.min(v.d.maxMana,v.energy+gain)
    end
    if direct and actual>0 and u.hp>0 then
        local vamp=(u.items.blood and .12 or 0)+(u.transformed and u.id=="kaneki" and .1 or 0)
        if options.area then vamp=vamp/3 end
        if kind=="basic" and u.d.faction=="TG" then vamp=vamp+.08*u.factionRank end
        if vamp>0 then self:heal(u,u,actual*math.min(.35,vamp*u.healPower),false) end
    end
    if v.hp>0 then
        Classes.injured(self,v)
        Boss.phase(self,v)
        if v.items.ixa and not v.ixaUsed and v.hp/v.maxHp<.35 then
            v.ixaUsed=true;self:shield(v,v,v.maxHp*.2,"IXA",4);v.ixaCounter=self.time+4
        end
        if actual>0 and v.items.arata and not v.arataUsed and v.hp/v.maxHp<.5 then
            v.arataUsed=true;self:buff(v,"arata",{reduction=.15},4);self:fx(v,"guard",v)
        end
        if actual>0 then self:checkCrystals(v) end
        if v.commander=="Kaneki" and not v.regenUsed and v.hp/v.maxHp<.3 then
            v.regenUsed=true;v.regenUntil=self.time+3;v.event="Regeneration"
        end
        if kind=="basic" then
            -- Counters react only to basic attacks; cannot recurse through item damage.
            for _,key in ipairs({"ixaCounter","arimaCounter"}) do
                if (v[key] or 0)>self.time and distance(v,u)<=2 then
                    v[key]=0;local ad,p=self:stats(v)
                    if key=="arimaCounter" then SkillEvents.counter(self,v,u) end
                    self:damage(v,u,ad*(key=="ixaCounter" and 1 or 1.8*p),"physical",{kind=key=="ixaCounter" and "item" or "ability",skillCounter=key=="arimaCounter"})
                end
            end
        end
    else
        Boss.cancel(self,v,"death");SkillEvents.stop(self,v,"death")
        v.cast=nil;v.ratioMarks=nil;Classes.kill(self,u,v,kind);self:log("death",u,v,0)
        self:expireControls()
    end
    return actual
end
function W:schedule(delay,callback)
    self.sequence=self.sequence+1;table.insert(self.queue,{at=self.time+delay,sequence=self.sequence,run=callback})
end
function W:line(u,target,limit,origin)
    origin=origin or u;local ox,oz=H.position(origin.col,origin.row);local tx,tz=H.position(target.col,target.row)
    local dx,dz=tx-ox,tz-oz;local length=math.sqrt(dx*dx+dz*dz);if length<.01 then return {} end
    local a={}
    for _,v in ipairs(self:alive(3-u.side)) do
        local x,z=H.position(v.col,v.row);local projection=((x-ox)*dx+(z-oz)*dz)/length
        local perpendicular=math.abs((x-ox)*dz-(z-oz)*dx)/length
        if projection>0 and perpendicular<=1.7 then table.insert(a,{unit=v,t=projection}) end
    end
    table.sort(a,function(x,y) if x.t~=y.t then return x.t<y.t end;return x.unit.uid<y.unit.uid end)
    local result={};for i=1,math.min(#a,limit or #a) do table.insert(result,a[i].unit) end;return result
end
function W:area(u,center)
    local a={};for _,v in ipairs(self:nearest(u)) do if distance(center,v)<=1 then table.insert(a,v) end end;return a
end
function W:cone(u,target,range,halfAngle)
    local ox,oz=H.position(u.col,u.row);local tx,tz=H.position(target.col,target.row)
    local dx,dz=tx-ox,tz-oz;local len=math.sqrt(dx*dx+dz*dz);local a={}
    for _,v in ipairs(self:nearest(u)) do
        local x,z=H.position(v.col,v.row);local vx,vz=x-ox,z-oz;local l=math.sqrt(vx*vx+vz*vz)
        if distance(u,v)<=(range or 2) and l>0 and len>0 and (vx*dx+vz*dz)/(l*len)>=math.cos(math.rad(halfAngle or 60))-1e-6 then table.insert(a,v) end
    end
    return a
end
function W:free(col,row,ignore)
    if not H.valid(col,row,false) then return false end
    for _,v in ipairs(self.units) do if v~=ignore and v.hp>0 and v.col==col and v.row==row then return false end end;return true
end
function W:dash(u,target,maxDistance,range,behind)
    if self:strongest(u,"root")>0 then return end
    local best,score;local ox,oz=H.position(u.col,u.row);local tx,tz=H.position(target.col,target.row)
    for row=0,7 do for col=0,6 do
        local p={col=col,row=row};local travel=distance(u,p);local remaining=distance(p,target)
        if self:free(col,row,u) and travel<=maxDistance and travel>0 then
            local valid=true
            if behind then local x,z=H.position(col,row);valid=remaining==1 and (x-tx)*(tx-ox)+(z-tz)*(tz-oz)>0 end
            local s=math.max(0,remaining-range)*100+travel
            if valid and (not score or s<score) and (remaining<distance(u,target) or remaining<=range or behind) then best=p;score=s end
        end
    end end
    if best then u.col,u.row=best.col,best.row;u.dashed=true;self:fx(u,"dash",target);self:log("dash",u,target,maxDistance) end
end
function W:move(u,target)
    if self:strongest(u,"root")>0 then return end
    local queue={{col=u.col,row=u.row}};local visited={[u.row*7+u.col]=true};local index=1
    while index<=#queue do
        local p=queue[index];index=index+1
        if p.first and distance(p,target)<=u.d.range then u.col,u.row=p.first.col,p.first.row;return end
        for row=math.max(0,p.row-1),math.min(7,p.row+1) do for col=math.max(0,p.col-1),math.min(6,p.col+1) do
            local q={col=col,row=row};local key=row*7+col
            if not visited[key] and distance(p,q)==1 and self:free(col,row,u) then visited[key]=true;q.first=p.first or q;table.insert(queue,q) end
        end end
    end
end
function W:afterCast(u,cast)
    if u.hp<=0 then return end
    Classes.complete(self,u,cast)
    local ad,p=self:stats(u)
    if u.items.rika and self.time+1e-6>=(u.rikaAt or 0) then
        local ally=self:supportTarget(u,"rika",2)
        if ally then
            u.rikaAt=self.time+6;self:shield(u,ally,ally.maxHp*.1,"rika",4)
            self:log("item",u,ally,0,"Rika's Ring")
        end
    end
    if u.items.odm and not u.odmUsed then
        u.odmUsed=true;local list=self:nearest(u);local target=list[#list]
        if target then self:dash(u,target,4,u.d.range) end
    end
    if u.items.katana and not u.katanaUsed then
        u.katanaUsed=true;local target=cast.target
        if target and target.hp>0 then
            if not u.items.odm then self:dash(u,target,2,u.d.range) end
            if distance(u,target)<=u.d.range then self:damage(u,target,ad,"physical",{kind="item"});self:fx(u,"item",target) end
        end
    end
    if u.items.narukami and cast.damaging and self.time>=(u.narukamiAt or 0) then
        u.narukamiAt=self.time+6
        for i,v in ipairs(self:line(u,cast.aim,3)) do self:damage(u,v,.8*ad*p*.75^(i-1),"magic",{kind="item",area=true}) end
        self:fx(u,"line",cast.aim)
    end
end
-- NPC-only skills use the same interruptible cast, mitigation and shield rules as heroes.
function W:castEnemy(u,target)
    if u.d.enemyClass=="boss" then return Boss.cast(self,u,target) end
    if not target then return false end
    local ad,p=self:stats(u)
    local kind=u.d.kind
    local cast={target=target,aim=point(target),ad=ad,p=p,damaging=true,weak=0,side=u.side,credit=self:credit(u)}
    if cast.damaging and (u.spearMark or 0)>self.time then cast.weak=.2;u.spearMark=0 end
    u.energy=0;u.cast=cast;u.casting=true;u.event=u.d.ability;u.lockUntil=self.time+.6
    u.skillCol,u.skillRow=target.col,target.row;u.castAttempts=u.castAttempts+1
    self:log("cast",u,target,0,u.id)
    self:schedule(.6,function()
        if u.hp<=0 or u.cast~=cast then return end
        self:inContext(u,cast,function()
        local function hit(v,amount,typ,area)
            self:damage(u,v,amount*p,typ,{kind="ability",area=area,weak=cast.weak})
        end
        local amount=cast.ad*u.d.coefficient
        if kind=="area" then
            for _,v in ipairs(self:area(u,cast.aim)) do hit(v,amount,"physical",true) end
            self:fx(u,"area",cast.aim)
        elseif kind=="cone" then
            for _,v in ipairs(self:cone(u,cast.aim)) do hit(v,amount,"physical",true) end
            self:fx(u,"cone",cast.aim)
        elseif kind=="line" then
            for i,v in ipairs(self:line(u,cast.aim,3)) do hit(v,amount*.75^(i-1),"physical",true) end
            self:fx(u,"line",cast.aim)
        else
            hit(target,amount,"physical",false)
            if u.d.stun>0 then self:stun(u,target,u.d.stun) end
        end
        self:afterCast(u,cast);u.casts=u.casts+1;u.cast=nil;self:log("complete",u,target,0,u.id);SkillEvents.stop(self,u,"complete")
        end)
    end)
    return true
end
function W:castAbility(u,target)
    if self:strongest(u,"silence")>0 then return false end
    if Expansion.Supported[u.id] then return Expansion.cast(self,u,target) end
    if u.d.npc then return self:castEnemy(u,target) end
    local a=D.Abilities[u.id];local id=u.id
    if id=="makima" then
        target=self:controlTarget(u)
    elseif id=="sinon" then local list=self:nearest(u,nil,4);target=list[#list]
    elseif id=="levi" then target=self:lowest(u,3-u.side,3) end
    if not target then return false end
    local ad,p=self:stats(u);local base=(a.base or 0)*u.scale
    local damaging=not (id=="silica" or id=="lisbeth" or (id=="denji" or id=="reiner" or id=="eren" or id=="kaneki") and not u.transformed or id=="arima" and u.castAttempts%2==1)
    local cast={target=target,aim=point(target),ad=ad,p=p,damaging=damaging,weak=0,side=u.side,credit=self:credit(u)}
    if damaging and (u.spearMark or 0)>self.time then cast.weak=.2;u.spearMark=0 end
    u.castAttempts=u.castAttempts+1;u.energy=0;u.cast=cast;u.casting=true;u.event=u.d.ability;u.skillCol,u.skillRow=target.col,target.row
    self:log("cast",u,target,0,u.id)
    SkillEvents.begin(self,u,target)
    local duration=(id=="kirito" or id=="levi" or id=="kobeni" or id=="juuzou") and a.duration or a.windup or .4
    u.lockUntil=self.time+duration
    local function hit(v,amount,typ,area,pen) return self:damage(u,v,amount*p,typ,{kind="ability",area=area,pen=pen,weak=cast.weak}) end
    local function damage(v,area,amount,typ) return hit(v,amount or base+(a.ad or 0)*ad,typ or "physical",area) end
    local function shield(v,amount) self:shield(u,v,amount*p,"ability:"..u.id);SkillEvents.impact(self,u,"shield",v) end
    local function heal(v,amount) self:heal(u,v,amount*p,true);SkillEvents.hit(self,u,v,"support") end
    local function later(delay,fn) self:schedule(delay,function() if u.hp>0 and u.cast==cast then self:inContext(u,cast,fn) end end) end
    local function transform()
        local old=u.maxHp;u.bonus.health=(u.bonus.health or 0)+a.hp;u.maxHp=u.d.health*u.scale*(1+u.bonus.health)
        self:heal(u,u,u.maxHp-old,false);u.transformed=true
        u.bonus.attack=(u.bonus.attack or 0)+(a.attack or 0);u.bonus.speed=(u.bonus.speed or 0)+(a.speed or 0);u.bonus.armor=(u.bonus.armor or 0)+(a.armor or 0)
        self:log("transform",u,u,u.maxHp-old)
        SkillEvents.impact(self,u,"transform",u)
    end
    if id=="kirito" or id=="levi" or id=="kobeni" or id=="juuzou" then
        local count=id=="kirito" and 8 or id=="levi" and 6 or id=="kobeni" and 3 or 4
        if id=="levi" or id=="kobeni" then self:dash(u,target,id=="levi" and 3 or 2,1);self:buff(u,"assault",{reduction=id=="levi" and .3 or .2},id=="levi" and duration or 1) end
        for i=1,count do later(duration*i/count,function()
            if target.hp<=0 and id=="kirito" then target=self:nearest(u,nil,1)[1] or target end
            if target.hp>0 then damage(target,false,a.ad*ad/count);if id=="juuzou" and i==1 then self:buff(target,"juuzouShred",{armorShred=.2},4) end end
        end) end
    elseif id=="yuji" then
        later(0,function() hit(target,a.ad*ad,"physical") end)
        later(a.delay,function() hit(target,a.base2*u.scale+a.ad2*ad,"magic") end)
    else later(duration,function()
        if id=="nobara" then
            damage(target,false,nil,"magic");u.mark={target=target,expires=self.time+4,count=3,power=p,weak=cast.weak}
        elseif id=="megumi" then
            damage(target,false,nil,"magic");damage(target,false,nil,"magic");self:buff(target,"megumiShred",{armorShred=a.shred,mrShred=a.shred},a.shredDuration)
        elseif id=="yuta" then
            local ally=self:lowest(u,u.side);if ally then heal(ally,base+a.ad*ad);shield(ally,a.shield*u.scale) end;hit(target,a.ad2*ad,"magic")
        elseif id=="gojo" or id=="sinon" then
            for i,v in ipairs(self:line(u,cast.aim,id=="sinon" and 3 or nil)) do
                local mult=id=="gojo" and math.max(.55,1-.15*(i-1)) or (i==1 and 1 or .6)
                hit(v,(base+a.ad*ad)*mult,id=="gojo" and "magic" or "physical",true,a.penetration)
            end;self:fx(u,"line",cast.aim)
        elseif id=="armin" and a.firstCastTransform and not u.transformed then
            u.transformed=true;self:log("transform",u,u,0)
            SkillEvents.impact(self,u,"transform",u)
            for _,v in ipairs(self:nearest(u))do if distance(u,v)<=a.transformRadius then
                hit(v,(base+a.ad*ad)*a.firstDamage,'magic',true)
                self:buff(v,'arminSlow',{slow=a.slow},3)
            end end
            self:fx(u,'steamBurst',u)
        elseif id=="aki" or id=="power" or id=="armin" then
            local center=id=="armin" and cast.aim or point(target)
            for _,v in ipairs(self:area(u,center)) do
                local mult=v==target and 1 or id=="aki" and .4 or id=="power" and .6 or 1
                hit(v,(base+a.ad*ad)*mult,id=="power" and "physical" or "magic",true)
                if id=="aki" and v==target then self:stun(u,v,.6) elseif id=="armin" then self:buff(v,"arminSlow",{slow=.2},3) end
            end
            if id=="power" then shield(u,a.shield*u.maxHp) end;self:fx(u,"area",center)
        elseif id=="makima" then
            if target.hp<=0 or target.side==u.side then target=self:controlTarget(u);cast.target=target end
            if target then
                cast.aim=point(target);u.skillCol,u.skillRow=target.col,target.row
                if not self:dominate(u,target,p*(1-cast.weak),a)then
                    damage(target,false,nil,'magic');self:buff(target,'commandSuppression',{adWeak=a.fallbackWeak},a.fallbackDuration)
                end
                SkillEvents.impact(self,u,'control',target)
            end
        elseif id=="silica" then local ally=self:lowest(u,u.side);if ally then heal(ally,base+a.ad*ad);self:buff(ally,"pina",{armor=15,mr=15},4,u) end
        elseif id=="lisbeth" then
            shield(u,u.maxHp*a.shield);local allies=self:nearest(u,u.side,1)
            table.sort(allies,function(x,y) if x.hp/x.maxHp~=y.hp/y.maxHp then return x.hp/x.maxHp<y.hp/y.maxHp end;return x.uid<y.uid end)
            local count=0;for _,v in ipairs(allies) do if v~=u and count<2 then shield(v,u.maxHp*a.shield*.5);count=count+1 end end
        elseif id=="asuna" then self:dash(u,target,2,1);damage(target);self:buff(u,"asunaSpeed",{speed=a.speed},3)
        elseif id=="mikasa" then
            local origin=point(u);local others=self:line(u,cast.aim);self:dash(u,target,3,1,true);damage(target)
            local count=0;for _,v in ipairs(others) do if v~=target and count<2 and distance(origin,v)<=distance(origin,u) then damage(v,true,a.ad*ad*.5);count=count+1 end end
            self:buff(u,"mikasaSpeed",{speed=a.speed},3);self:fx(u,"line",cast.aim)
        elseif id=="amon" then shield(u,a.shield*u.maxHp);self:buff(u,"quinqueGuard",{armor=a.armor},4);damage(target)
        elseif id=="arima" then
            if u.castAttempts%2==1 then
                damage(target);local beyond=false
                for _,v in ipairs(self:line(u,cast.aim)) do if beyond then damage(v,true,a.ad*ad*.5);break end;if v==target then beyond=true end end
                self:fx(u,"line",cast.aim)
            else shield(u,a.shield*u.scale);u.arimaCounter=self.time+4 end
        elseif id=="touka" then local targets=self:nearest(u,nil,3);local n=math.min(3,#targets)
            if n>0 then for i=1,5 do damage(targets[(i-1)%n+1],true,nil,"magic") end end
        elseif id=="denji" or id=="reiner" or id=="eren" or id=="kaneki" then
            if not u.transformed then transform()
            elseif id=="denji" then damage(target);self:buff(target,"chainsawWound",{antiheal=.3},4)
            elseif id=="reiner" then shield(u,a.shield*u.maxHp);damage(target)
            else
                for _,v in ipairs(self:cone(u,cast.aim)) do damage(v,true);if id=="eren" then self:stun(u,v,a.stun) end end
                if id=="kaneki" then heal(u,a.heal*u.maxHp) end;self:fx(u,"cone",cast.aim)
            end
        end
    end) end
    later(duration,function()
        -- Snapshot cast power before awarding JJK stacks; no retroactive first-cast buff.
        self:afterCast(u,cast);u.casts=u.casts+1;u.cast=nil
        self:log("complete",u,target,0,u.id);SkillEvents.stop(self,u,"complete")
    end)
    return true
end
function W:basic(u,target)
    if u.control then u.control.basicCount=u.control.basicCount+1 end
    Boss.face(u,target)
    local ad=self:stats(u);local crit=self:random()<math.min(1,.2+(u.bonus.crit or 0))
    u.hits=u.hits+1;u.energy=math.min(u.d.maxMana,u.energy+D.ManaPerAttack);u.event="Attack"
    local critBonus=crit and (.5+(u.bonus.critDamage or 0)) or 0
    self:damage(u,target,ad*(1+critBonus)*Expansion.basic(self,u,target),"physical",{kind="basic",critBonus=critBonus})
    self:log("attack",u,target,crit and 1 or 0)
    if u.hp<=0 then return end
    Classes.basic(self,u,target,ad)
    Boss.basic(self,u,target,ad)
    local function hit(v,amount,typ,area) self:damage(u,v,amount,typ or "physical",{kind="item",area=area}) end
    if u.mark and u.mark.target==target and u.mark.expires>self.time and u.mark.count>0 then
        u.mark.count=u.mark.count-1;self:damage(u,target,35*u.scale*u.mark.power,"magic",{kind="ability",weak=u.mark.weak})
    end
    if u.items.cloud and u.hits%3==0 then hit(target,.4*ad);self:fx(u,"item",target) end
    if u.items.spear and self.time>=(u.spearAt or 0) and target.hp>0 then target.spearMark=self.time+4;u.spearAt=self.time+6 end
    if u.items.captain and crit and self.time>=(u.captainAt or 0) then u.captainAt=self.time+4;hit(target,.25*ad);hit(target,.25*ad);self:fx(u,"item",target) end
    if u.items.repulser and u.hits%5==0 then for _,v in ipairs(self:line(u,target,3)) do hit(v,.8*ad,"physical",true) end;self:fx(u,"line",target) end
    if u.items.excalibur and u.hits%4==0 then local count=0;for _,v in ipairs(self:area(u,target)) do if v~=target and count<2 then hit(v,.6*ad,"physical",true);count=count+1 end end;self:fx(u,"area",target) end
    if u.items.chainsaw and target.hp>0 then
        local active={};local count=0
        for _,bleed in ipairs(target.bleeds) do if bleed.expires>=self.time then
            table.insert(active,bleed);if not bleed.bossClaws then count=count+1 end
        end end;target.bleeds=active
        if count<3 then table.insert(active,{source=u,credit=self:credit(u),damage=.15*ad,nextTick=self.time+1,expires=self.time+3})
        else for _,bleed in ipairs(active) do if not bleed.bossClaws then bleed.expires=self.time+3 end end end
    end
    if u.items.rinkaku and self.time>=(u.rinkakuAt or 0) then
        u.rinkakuHits=u.rinkakuHits+1
        if u.rinkakuHits>=4 then u.rinkakuHits=0;u.rinkakuAt=self.time+3;hit(target,.2*ad);hit(target,.2*ad);self:heal(u,u,u.maxHp*.03,true);self:fx(u,"item",target) end
    end
end
function W:step(dt)
    self.time=self.time+dt
    self:expireControls()
    -- Execute scheduled events by time, then insertion order (completion after final hit).
    table.sort(self.queue,function(a,b) if a.at~=b.at then return a.at<b.at end;return a.sequence<b.sequence end)
    while self.queue[1] and self.queue[1].at<=self.time+1e-6 do local e=table.remove(self.queue,1);e.run() end
    Boss.step(self)
    for _,u in ipairs(self.units) do if u.hp>0 then
        self:supportItems(u)
        if u.regenUntil and u.regenUntil>self.time-dt then self:heal(u,u,u.maxHp*.05*math.min(dt,u.regenUntil-(self.time-dt)),false) end
        for _,bleed in ipairs(u.bleeds) do
            if bleed.nextTick<=self.time+1e-6 and bleed.nextTick<=bleed.expires+1e-6 then
                self:damage(bleed.source,u,bleed.damage,"physical",{kind="dot",credit=bleed.credit});bleed.nextTick=bleed.nextTick+1
            end
        end
    end end
    for index=1,#self.units do
        local u=self.units[self.tick%2==0 and (#self.units-index+1) or index]
        if u.hp>0 then
            local target=self:nearest(u)[1]
            if target then
                Boss.face(u,target)
                local aim=(u.d.enemyClass=="boss" or u.cast and u.cast.expansion) and u.cast and u.cast.aim or target
                u.aimCol,u.aimRow=aim.col,aim.row
                if u.items.thunder and self.time>=u.thunderAt then
                    u.thunderAt=u.thunderAt+6;local ad=self:stats(u)
                    for _,v in ipairs(self:area(u,target)) do self:damage(u,v,ad,"physical",{kind="item",area=true}) end;self:fx(u,"area",target)
                end
                if not u.cast and self.time>=(u.lockUntil or 0) and self.time>=(u.stunUntil or 0) then
                    if u.energy>=u.d.maxMana and self:strongest(u,"silence")==0 then
                        if not self:castAbility(u,target) and self.time>=u.moveAt then self:move(u,target);u.moveAt=self.time+.35 end
                    elseif distance(u,target)>u.d.range then
                        if self.time>=u.moveAt then self:move(u,target);u.moveAt=self.time+.35 end
                    else
                        local _,_,speed=self:stats(u);u.attackProgress=u.attackProgress+dt*speed
                        if u.attackProgress>=1 and self:canBasic(u) then u.attackProgress=u.attackProgress-1;self:basic(u,target) end
                    end
                end
            end
        end
    end
    self.tick=self.tick+1
end
function W:snapshot()
    local frame={}
    for _,u in ipairs(self.units) do
        local shields=0;for _,s in pairs(u.shields) do if s.expires>self.time then shields=shields+s.amount end end
        local ad,p,speed,armor,mr=self:stats(u)
        local statuses={}
        if u.ratioMarks and next(u.ratioMarks) then table.insert(statuses,"7:3") end
        if self:strongest(u,"root")>0 then table.insert(statuses,"ROOT") end
        if self:strongest(u,"silence")>0 then table.insert(statuses,"SILENCED") end
        if u.focus and u.focus.expires>self.time then table.insert(statuses,"FOCUS") end
        if u.control then table.insert(statuses,'CONTROLLED')end
        table.insert(frame,{uid=u.uid,id=u.id,side=u.ownerSide or u.side,col=u.col,row=u.row,hp=u.hp,maxHp=u.maxHp,shield=shields,statuses=statuses,
            controlSide=u.control and u.side or nil,controllerUid=u.control and u.control.source.uid or nil,
            controllerSide=u.control and (u.control.source.ownerSide or u.control.source.side)or nil,
            stars=u.stars,event=u.event,transformed=u.transformed,npc=u.npc,bossPhase=u.bossPhase,aimCol=u.aimCol,aimRow=u.aimRow,
            bossVisual=Boss.frame(self,u),bossBleed=Boss.bleedFrame(self,u),skillVisual=SkillEvents.frame(self,u),
            mana=u.energy,maxMana=u.d.maxMana,casting=u.casting==true,skillCol=u.skillCol,skillRow=u.skillRow,
            effects=u.effects,dashed=u.dashed,attack=ad,speed=speed,power=p,armor=armor,mr=mr,items=u.sourceItems})
        u.event=nil;u.casting=nil;u.effects=nil;u.dashed=nil;u.bossCues=nil
    end
    return frame
end
function B.create(left,right,seed)
    local w=setmetatable({units={},time=0,tick=0,queue={},sequence=0,events={},seed=seed or 1729},W)
    for side,player in ipairs({left,right}) do
        local traits=G.traits(player.units);local strongest
        for _,source in ipairs(player.units) do if source.col~=nil then
            local d=R.ById[source.id];local scale=D.StarScale^(source.stars-1);local items,bonus={},{}
            for _,index in ipairs(source.items) do local item=C.Items[index]
                if item and not items[item.key] then items[item.key]=true
                    for _,key in ipairs({"health","attack","speed","power","armor","mr","crit","healPower"}) do bonus[key]=(bonus[key] or 0)+(item[key] or 0) end
                end
            end
            local rank=d.npc and 0 or D.rank(d.role,traits[d.role] or 0)
            local statRank=math.min(2,rank)
            if d.role=="Guardian" then bonus.armor=(bonus.armor or 0)+15*statRank;bonus.mr=(bonus.mr or 0)+15*statRank
            elseif d.role=="Fighter" then bonus.attack=(bonus.attack or 0)+.12*statRank
            elseif d.role=="Assassin" then bonus.crit=(bonus.crit or 0)+.1*statRank;bonus.critDamage=.1*statRank
            elseif d.role=="Ranger" then bonus.speed=(bonus.speed or 0)+.1*statRank
            elseif d.role=="Caster" then bonus.power=(bonus.power or 0)+.15*statRank end
            if player.commander=="Levi" then
                local isolated=true;for _,v in ipairs(player.units) do if v~=source and v.col~=nil and distance(source,v)<=1 then isolated=false end end
                if isolated then bonus.speed=(bonus.speed or 0)+.1 end
            end
            local hp=d.health*scale*(1+(bonus.health or 0))*(source.mult and source.mult.hp or 1)
            local u={uid=source.uid,id=source.id,d=d,side=side,ownerSide=side,stars=source.stars,scale=scale,
                col=side==1 and source.col or 6-source.col,row=side==1 and source.row or 7-source.row,
                hp=hp,maxHp=hp,attackMult=source.mult and source.mult.attack or 1,dealt=0,taken=0,healed=0,
                items=items,sourceItems=table.clone(source.items),bonus=bonus,buffs={},shields={},bleeds={},damageMana={},supportLocks={},
                energy=d.startMana,attackProgress=0,moveAt=0,hits=0,casts=0,castAttempts=0,rinkakuHits=0,thunderAt=6,bloodSupplyAt=6,bloodSupplyUses=0,signalAt=8,
                commander=player.commander,roleRank=rank,factionRank=d.npc and 0 or D.rank(d.faction,traits[d.faction] or 0),npc=source.npc,
                durationPower=d.role=="Support" and (statRank==2 and 1.2 or statRank==1 and 1.1 or 1) or 1,
                healPower=1+(bonus.healPower or 0)+(d.role=="Support" and (statRank==2 and .3 or statRank==1 and .2 or 0) or 0)}
            table.insert(w.units,u)
            if not strongest or w:stats(u)>w:stats(strongest) then strongest=u end
        end end
        if strongest and player.commander=="Kirito" then strongest.carry=true end
    end
    for _,u in ipairs(w.units) do
        Boss.init(w,u)
        if u.d.role=="Guardian" and u.roleRank>0 then
            for _,v in ipairs(w:alive(u.side)) do if v~=u and distance(u,v)==1 then w:shield(u,v,u.maxHp*(u.roleRank>=2 and .1 or .06),"guardian",5) end end
        end
    end
    return w
end
function B.run(left,right,round,seed)
    local w=B.create(left,right,seed or math.random(1,2147483646));local frames={w:snapshot()}
    for _=1,C.CombatTicks do
        if #w:survivors(1)==0 or #w:survivors(2)==0 then break end
        w:step(C.CombatStepSeconds);table.insert(frames,w:snapshot())
    end
    local a,b=w:survivors(1),w:survivors(2);local winner=#a>0 and #b==0 and 1 or #b>0 and #a==0 and 2 or 0
    local function damage(survivors) local n=1+math.floor(round/5);for _,u in ipairs(survivors) do n=n+u.stars end;return n end
    local function stats(side)
        local result={}
        for _,u in ipairs(w.units) do if (u.ownerSide or u.side)==side then
            table.insert(result,{uid=u.uid,id=u.id,stars=u.stars,dealt=math.floor(u.dealt+.5),taken=math.floor(u.taken+.5),healed=math.floor(u.healed+.5)})
        end end
        return result
    end
    return {frames=frames,events=w.events,winner=winner,statsLeft=stats(1),statsRight=stats(2),damageLeft=winner==1 and 0 or winner==0 and 2 or damage(b),damageRight=winner==2 and 0 or winner==0 and 2 or damage(a)}
end
function B.npc(round,seen)
    local p={units={},commander="NPC"}
    local T=C.EnemyBalance
    local bossInterval=C.NPCRoundInterval*2
    if round%bossInterval==0 then
        local n=round/bossInterval
        local pool={}
        for _,id in ipairs(R.BossIds) do if not (seen and seen[id]) then table.insert(pool,id) end end
        if #pool==0 then
            if seen then table.clear(seen) end
            pool=table.clone(R.BossIds)
        end
        local id=pool[math.random(#pool)]
        if seen then seen[id]=true end
        local u=G.unit(id); u.col=3; u.row=3; u.stars=3
        local strength=R.ById[id].strength or 1
        u.mult={hp=(T.BossHealth.base+T.BossHealth.perBoss*(n-1))*strength,attack=(T.BossAttack.base+T.BossAttack.perBoss*(n-1))*strength}
        u.npc="Boss "..R.ById[id].name
        table.insert(p.units,u)
        p.label="Boss: "..R.ById[id].name
    else
        local stars=1 -- EnemyBalance multipliers grow creeps without star-rank difficulty cliffs.
        local mult={hp=T.CreepHealth.base+T.CreepHealth.perRound*round,attack=T.CreepAttack.base+T.CreepAttack.perRound*round}
        local cols={1,3,5}
        for i=1,T.CreepCount do
            local id=R.CreepIds[(i-1)%#R.CreepIds+1]
            local u=G.unit(id); u.col=cols[i] or (i-1)%7; u.row=3; u.stars=stars; u.mult=mult
            u.npc=R.ById[id].name
            table.insert(p.units,u)
        end
        p.label="Creep encounter"
    end
    return p
end
return B
