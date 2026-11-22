<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class TimelineEvent extends Model
{
    use HasFactory;

    protected $fillable = [
        'timelineable_type',
        'timelineable_id',
        'type',
        'description',
        'meta',
        'user_id',
    ];

    protected $casts = [
        'meta' => 'array',
    ];

    public function timelineable(): MorphTo
    {
        return $this->morphTo();
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
