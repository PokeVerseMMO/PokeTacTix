-- Six-unit mechanics have no recursive casts, crits or equipment triggers.
local M={}
function M.duration(source,seconds)
    return seconds*(source and source.d.role=="Support" and (source.durationPower or 1) or 1)
end
function M.injured(w,v)
    if v.hp>0 and v.d.role=="Guardian" and v.roleRank==3 and not v.lastBastion and v.hp/v.maxHp<.35 then
        v.lastBastion=true
        for _,ally in ipairs(w:nearest(v,v.side,1)) do w:shield(v,ally,ally.maxHp*.15,"lastBastion",5) end
        w:log("synergy",v,v,0,"Last Bastion")
    end
end
function M.kill(w,u,v,kind)
    if u.hp>0 and u.d.role=="Assassin" and u.roleRank==3 and (kind=="basic" or kind=="ability") then
        if not u.cast then u.energy=math.min(u.d.maxMana,u.energy+20) end
        w:buff(u,"chainHunt",{speed=.25},3);w:log("synergy",u,v,0,"Chain Hunt")
    end
end
function M.basic(w,u,target,ad)
    if u.roleRank~=3 then return end
    if u.d.role=="Fighter" and u.hits%4==0 then
        w:buff(u,"battleRhythm",{speed=.2,reduction=.15},3);w:log("synergy",u,u,0,"Battle Rhythm")
    elseif u.d.role=="Ranger" and u.hits%4==0 then
        for _,v in ipairs(w:nearest(u,nil,u.d.range)) do if v~=target then
            w:damage(u,v,.5*ad,"physical",{kind="synergy"});w:fx(u,"item",v);w:log("synergy",u,v,0,"Crossfire");break
        end end
    end
end
function M.capture(u,v,raw,typ,options)
    if u.roleRank==3 and u.d.role=="Caster" and u.cast and options.kind=="ability" and not options.skillCounter then
        local cast=u.cast;cast.echoHits=cast.echoHits or {}
        table.insert(cast.echoHits,{target=v,raw=raw*(1-(options.weak or 0)),typ=typ})
    end
end
function M.complete(w,u,cast)
    if u.roleRank~=3 then return end
    if u.d.role=="Caster" and (u.casts+1)%3==0 and cast.echoHits and #cast.echoHits>0 then
        local hits=cast.echoHits
        w:schedule(.25,function()
            if u.hp<=0 then return end
            for _,hit in ipairs(hits) do if hit.target.hp>0 then w:damage(u,hit.target,hit.raw*.35,hit.typ,{kind="synergy"}) end end
            w:log("synergy",u,u,0,"Spell Echo")
        end)
    elseif u.d.role=="Support" then
        local ally=w:lowest(u,u.side,3)
        if ally then
            w:shield(u,ally,ally.maxHp*.08,"supportRally",3)
            if not ally.cast then ally.energy=math.min(ally.d.maxMana,ally.energy+10) end
            w:log("synergy",u,ally,0,"Rally")
        end
    end
end
return M
